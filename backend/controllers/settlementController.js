const Expense = require('../models/Expense');
const Group = require('../models/Group');
const { Payment, SettlementCycle } = require('../models/PaymentSettlement');
const { calculateFairSettlement, toIdStr } = require('../utils/expenseCalculation');
const { Expo } = require('expo-server-sdk');

const expo = new Expo();

// ── Helper: Verify group membership and populate members ────────────────────
const assertMember = async (groupId, userId) => {
  const g = await Group.findById(groupId).populate('members', 'name email fcmTokens').lean();
  if (!g) throw Object.assign(new Error('Group not found'), { status: 404 });
  if (!g.members.some(m => m._id.toString() === userId.toString())) {
    throw Object.assign(new Error('Not a member of this group'), { status: 403 });
  }
  return g;
};

// ── GET Pending Settlement ──────────────────────────────────────────────────
// Returns live balances, debtor-creditor transfers and settlement status
// for all un-settled expenses and actual payments (settlementCycle === null).
exports.getPendingSettlement = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await assertMember(groupId, req.user._id);

    // Fetch un-settled pending expenses
    const expenses = await Expense.find({ group: groupId, settlementCycle: null })
      .populate('user', 'name email')
      .populate('excludedMembers', 'name email')
      .sort({ date: -1, _id: -1 })
      .lean();

    // Fetch un-settled peer-to-peer payments
    const payments = await Payment.find({ group: groupId, settlementCycle: null })
      .populate('from', 'name email')
      .populate('to', 'name email')
      .sort({ date: -1, _id: -1 })
      .lean();

    // Calculate fair settlement with integer-paise precision
    const settlement = calculateFairSettlement(expenses, group.members, payments);

    res.json({
      groupId,
      expensesCount: expenses.length,
      paymentsCount: payments.length,
      totalExpenses: settlement.totalSpent,
      totalExpensesPaise: settlement.totalExpensesPaise,
      totalPayments: settlement.totalPayments,
      totalPaymentsPaise: settlement.totalPaymentsPaise,
      memberBalances: settlement.memberBalances,
      suggestedTransfers: settlement.txns,
      isSettled: settlement.isSettled,
      expenses,
      payments,
    });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
};

// ── POST Record Actual Peer-to-Peer Payment ────────────────────────────────
// Records actual cash / UPI payments between roommates (supports partial payments)
exports.recordPayment = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await assertMember(groupId, req.user._id);

    const { toUserId, fromUserId, amount, note, date } = req.body;

    const fromId = toIdStr(fromUserId || req.user._id);
    const toId = toIdStr(toUserId);

    if (!toId) {
      return res.status(400).json({ message: 'Recipient member (toUserId) is required' });
    }
    if (fromId === toId) {
      return res.status(400).json({ message: 'Cannot record a payment to yourself' });
    }

    if (!amount || isNaN(amount) || +amount <= 0) {
      return res.status(400).json({ message: 'Valid positive payment amount required' });
    }

    // Verify both sender and receiver belong to this group
    const memberIdSet = new Set(group.members.map(m => m._id.toString()));
    if (!memberIdSet.has(fromId) || !memberIdSet.has(toId)) {
      return res.status(400).json({ message: 'Both sender and recipient must belong to this group' });
    }

    const amountPaise = Math.round(+amount * 100);
    const paymentDate = date || new Date().toISOString().split('T')[0];

    const payment = await Payment.create({
      group: groupId,
      from: fromId,
      to: toId,
      amount: Number((amountPaise / 100).toFixed(2)),
      amountPaise,
      date: paymentDate,
      status: 'confirmed',
      note: note?.trim() || '',
      settlementCycle: null, // Fresh payments remain pending until settlement completion
    });

    const populatedPayment = await payment.populate([
      { path: 'from', select: 'name email' },
      { path: 'to', select: 'name email' },
    ]);

    // Recalculate pending settlement with newly recorded payment
    const expenses = await Expense.find({ group: groupId, settlementCycle: null }).lean();
    const payments = await Payment.find({ group: groupId, settlementCycle: null })
      .populate('from', 'name email')
      .populate('to', 'name email')
      .lean();

    const pendingSettlement = calculateFairSettlement(expenses, group.members, payments);

    // Real-Time Socket.IO notification to all group members
    const io = req.app.get('io');
    if (io) {
      io.to(groupId).emit('paymentRecorded', {
        payment: populatedPayment,
        pendingSettlement,
      });
    }

    // Push notification to recipient
    try {
      const recipient = group.members.find(m => m._id.toString() === toId);
      const sender = group.members.find(m => m._id.toString() === fromId);

      if (recipient?.fcmTokens?.length) {
        const messages = [];
        for (const token of recipient.fcmTokens) {
          if (!Expo.isExpoPushToken(token)) continue;
          messages.push({
            to: token,
            sound: 'default',
            title: `Payment Received in ${group.name}`,
            body: `${sender?.name || 'A roommate'} recorded a payment of ₹${Number((amountPaise / 100).toFixed(2))} to you`,
            data: { groupId },
          });
        }
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
          expo.sendPushNotificationsAsync(chunk).catch(console.error);
        }
      }
    } catch (pushErr) {
      console.error('Payment push notification error:', pushErr);
    }

    res.status(201).json({
      success: true,
      payment: populatedPayment,
      pendingSettlement,
    });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
};

// ── POST Complete and Freeze Settlement Cycle ──────────────────────────────
// Freezes all pending expenses and payments into an immutable SettlementCycle record.
// All historical records remain fully preserved and will not count towards next cycle.
exports.completeSettlement = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await assertMember(groupId, req.user._id);

    const expenses = await Expense.find({ group: groupId, settlementCycle: null })
      .populate('user', 'name email')
      .lean();

    const payments = await Payment.find({ group: groupId, settlementCycle: null })
      .populate('from', 'name email')
      .populate('to', 'name email')
      .lean();

    if (expenses.length === 0 && payments.length === 0) {
      return res.status(400).json({ message: 'No pending expenses or payments to settle.' });
    }

    const settlement = calculateFairSettlement(expenses, group.members, payments);

    // Require zero balances unless client explicitly confirms completion (force: true)
    if (!settlement.isSettled && !req.body.force) {
      return res.status(400).json({
        message: 'Cannot complete settlement: Balances are not yet settled (zero). Please record remaining payments or pass force: true.',
        suggestedTransfers: settlement.txns,
        memberBalances: settlement.memberBalances,
      });
    }

    const cycleTitle = req.body.title?.trim() ||
      `Settlement - ${new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // Create immutable historical snapshot
    const cycle = await SettlementCycle.create({
      group: groupId,
      title: cycleTitle,
      status: 'completed',
      settledAt: new Date(),
      settledBy: req.user._id,
      totalExpensesPaise: settlement.totalExpensesPaise,
      totalPaymentsPaise: settlement.totalPaymentsPaise,
      memberBalances: settlement.memberBalances.map(b => ({
        user: b.id,
        name: b.name,
        paidPaise: b.paidPaise,
        sharePaise: b.sharePaise,
        netPaise: b.netBalancePaise,
      })),
      transactions: settlement.txns.map(t => ({
        from: t.fromId,
        fromName: t.from,
        to: t.toId,
        toName: t.to,
        amountPaise: t.amountPaise,
        amountRupees: Number((t.amountPaise / 100).toFixed(2)),
      })),
    });

    // Freeze all current pending expenses by attaching settlementCycle ID
    await Expense.updateMany(
      { group: groupId, settlementCycle: null },
      { $set: { settlementCycle: cycle._id } }
    );

    // Freeze all current pending payments by attaching settlementCycle ID
    await Payment.updateMany(
      { group: groupId, settlementCycle: null },
      { $set: { settlementCycle: cycle._id } }
    );

    // Notify all members in real time via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(groupId).emit('settlementCompleted', {
        cycleId: cycle._id,
        cycle,
      });
    }

    res.json({
      success: true,
      message: 'Settlement completed and frozen successfully.',
      cycle,
    });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
};

// ── GET Historical Completed Settlement Cycles ─────────────────────────────
// Returns list of all past frozen settlement cycles
exports.getSettlementHistory = async (req, res) => {
  try {
    const { groupId } = req.params;
    await assertMember(groupId, req.user._id);

    const cycles = await SettlementCycle.find({ group: groupId })
      .populate('settledBy', 'name email')
      .sort({ settledAt: -1 })
      .lean();

    res.json(cycles);
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
};

// ── GET Specific Settlement Cycle Details ──────────────────────────────────
// Returns snapshot, plus all frozen expenses and payments for that cycle
exports.getSettlementCycleDetails = async (req, res) => {
  try {
    const { groupId, cycleId } = req.params;
    await assertMember(groupId, req.user._id);

    const cycle = await SettlementCycle.findOne({ _id: cycleId, group: groupId })
      .populate('settledBy', 'name email')
      .lean();

    if (!cycle) {
      return res.status(404).json({ message: 'Settlement cycle not found' });
    }

    const expenses = await Expense.find({ settlementCycle: cycleId })
      .populate('user', 'name email')
      .populate('excludedMembers', 'name email')
      .lean();

    const payments = await Payment.find({ settlementCycle: cycleId })
      .populate('from', 'name email')
      .populate('to', 'name email')
      .lean();

    res.json({
      cycle,
      expenses,
      payments,
    });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
};

