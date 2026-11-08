const Expense = require('../models/Expense');
const Group   = require('../models/Group');
const { Expo } = require('expo-server-sdk');
const { calculateExpenseShares, toIdStr } = require('../utils/expenseCalculation');

const expo = new Expo();

// ── Helper: Verify group membership ────────────────────────────────────────
const assertMember = async (groupId, userId) => {
  // Use .lean() and select only members array — fast lookup
  const g = await Group.findById(groupId).select('members').lean();
  if (!g) throw Object.assign(new Error('Group not found'), { status: 404 });
  if (!g.members.some(m => m.toString() === userId.toString()))
    throw Object.assign(new Error('Not a member of this group'), { status: 403 });
  return g;
};

// ── Helper: Category-based default exclusion suggestions ───────────────────
// Provides initial suggestions based on category (rent/utilities = everyone included).
// Users can override before saving; final selection is saved with the expense.
const getCategoryDefaultExclusions = (category = 'other', groupMembers = []) => {
  switch (category) {
    case 'rent':
    case 'util':
    case 'grocery':
      return []; // Common household bills are shared by everyone by default
    default:
      return []; // Everyone included by default, user manually excludes
  }
};

// ── Helper: Validate and sanitize excludedMembers ──────────────────────────
// Enforces Test 10: Rejects foreign member IDs and rejecting excluding all members.
const validateExcludedMembers = (excludedMembers, groupMembers = []) => {
  if (!excludedMembers || !Array.isArray(excludedMembers)) return [];

  const memberIdSet = new Set(groupMembers.map(toIdStr));

  // Check for foreign member IDs not belonging to this group
  for (const rawId of excludedMembers) {
    const strId = toIdStr(rawId);
    if (!memberIdSet.has(strId)) {
      throw Object.assign(
        new Error(`Invalid exclusion: Member ${strId} does not belong to this group`),
        { status: 400 }
      );
    }
  }

  // Deduplicate member IDs
  const uniqueExcluded = [...new Set(excludedMembers.map(toIdStr))];

  // At least one member must remain to consume the expense
  if (uniqueExcluded.length >= groupMembers.length) {
    throw Object.assign(
      new Error('Cannot exclude all members. At least one member must consume this expense.'),
      { status: 400 }
    );
  }

  return uniqueExcluded;
};

// ── GET Category Defaults ──────────────────────────────────────────────────
// Provides suggested initial participant exclusions for a category
exports.getCategoryDefaults = async (req, res) => {
  try {
    const group = await assertMember(req.params.groupId, req.user._id);
    const category = req.query.category || 'other';
    const suggestedExcluded = getCategoryDefaultExclusions(category, group.members);
    res.json({ category, suggestedExcluded });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
};

// ── GET Expenses with cursor-based pagination ──────────────────────────────
exports.getExpenses = async (req, res) => {
  try {
    const group = await assertMember(req.params.groupId, req.user._id);

    const { date, month, category, search, cursor, limit = 50 } = req.query;
    const filter = { group: req.params.groupId };

    // Cursor: fetch docs with _id less than the cursor (newer docs first)
    if (cursor)   filter._id = { $lt: cursor };
    if (date)     filter.date = date;
    if (month)    filter.date = { $regex: `^${month}` };
    if (category) filter.category = category;
    if (search)   filter.$or = [
      { item: { $regex: search, $options: 'i' } },
      { note: { $regex: search, $options: 'i' } },
    ];

    const expenses = await Expense.find(filter)
      .populate('user', 'name email')
      .populate('excludedMembers', 'name email')
      .sort({ _id: -1 })
      .limit(Number(limit))
      .lean();

    // Attach exact calculated integer paise shares to each expense
    const expensesWithShares = expenses.map(exp => {
      const shareResult = calculateExpenseShares(exp, group.members);
      return {
        ...exp,
        shares: shareResult.sharesRupees,
        sharesPaise: shareResult.sharesPaise,
      };
    });

    res.json({
      data: expensesWithShares,
      nextCursor: expenses.length >= Number(limit) ? expenses[expenses.length - 1]._id : null,
    });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
};

// ── POST Create Expense ────────────────────────────────────────────────────
exports.createExpense = async (req, res) => {
  try {
    const group = await assertMember(req.params.groupId, req.user._id);
    const { item, amount, date, note, category, recurring, splitType, splitWeights, excludedMembers } = req.body;

    if (!item?.trim()) return res.status(400).json({ message: 'Item name required' });
    if (!amount || isNaN(amount) || +amount <= 0) return res.status(400).json({ message: 'Valid amount required' });
    if (!date) return res.status(400).json({ message: 'Date required' });

    // Validate excluded members: reject foreign users, reject excluding everyone, deduplicate
    const sanitizedExcluded = validateExcludedMembers(excludedMembers, group.members);

    const exp = await Expense.create({
      group: req.params.groupId,
      user: req.user._id,
      item: item.trim(),
      amount: +amount,
      date,
      note: note?.trim() || '',
      category: category || 'other',
      recurring: !!recurring,
      splitType: splitType || 'equal',
      splitWeights: splitWeights || {},
      excludedMembers: sanitizedExcluded,
      settlementCycle: null, // Fresh expenses are always pending
    });

    const populatedExp = await exp.populate([
      { path: 'user', select: 'name email' },
      { path: 'excludedMembers', select: 'name email' },
    ]);

    // Attach exact calculated shares for consumers
    const expObj = populatedExp.toObject();
    const shareResult = calculateExpenseShares(expObj, group.members);
    expObj.shares = shareResult.sharesRupees;
    expObj.sharesPaise = shareResult.sharesPaise;

    const io = req.app.get('io');
    if (io) io.to(req.params.groupId).emit('expenseCreated', expObj);

    // ── Send Push Notifications ──────────────────────────────────────────────
    try {
      const g = await Group.findById(req.params.groupId).populate('members', 'fcmTokens name');
      const tokens = [];
      g.members.forEach(m => {
        if (m._id.toString() !== req.user._id.toString() && m.fcmTokens?.length) {
          tokens.push(...m.fcmTokens);
        }
      });

      const messages = [];
      for (let pushToken of tokens) {
        if (!Expo.isExpoPushToken(pushToken)) continue;
        messages.push({
          to: pushToken,
          sound: 'default',
          title: `New Expense in ${g.name}`,
          body: `${populatedExp.user.name} added ${item.trim()} for ₹${amount}`,
          data: { groupId: g._id },
        });
      }
      
      const chunks = expo.chunkPushNotifications(messages);
      for (let chunk of chunks) {
        expo.sendPushNotificationsAsync(chunk).catch(console.error);
      }
    } catch (pushErr) { console.error('Push Error:', pushErr); }

    res.status(201).json(expObj);
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
};

// ── PUT Update Expense ────────────────────────────────────────────────────
exports.updateExpense = async (req, res) => {
  try {
    const group = await assertMember(req.params.groupId, req.user._id);
    const { item, amount, date, note, category, recurring, splitType, splitWeights, excludedMembers } = req.body;

    const updates = {};
    if (item !== undefined)          updates.item = item.trim();
    if (amount !== undefined)        updates.amount = +amount;
    if (date !== undefined)          updates.date = date;
    if (note !== undefined)          updates.note = note.trim();
    if (category !== undefined)      updates.category = category;
    if (recurring !== undefined)     updates.recurring = recurring;
    if (splitType !== undefined)     updates.splitType = splitType;
    if (splitWeights !== undefined)  updates.splitWeights = splitWeights;
    if (excludedMembers !== undefined) {
      updates.excludedMembers = validateExcludedMembers(excludedMembers, group.members);
    }

    const exp = await Expense.findOneAndUpdate(
      { _id: req.params.expenseId, user: req.user._id },
      updates,
      { new: true, runValidators: true }
    )
      .populate('user', 'name email')
      .populate('excludedMembers', 'name email');

    if (!exp) return res.status(404).json({ message: 'Expense not found or not authorized' });

    const expObj = exp.toObject();
    const shareResult = calculateExpenseShares(expObj, group.members);
    expObj.shares = shareResult.sharesRupees;
    expObj.sharesPaise = shareResult.sharesPaise;

    const io = req.app.get('io');
    if (io) io.to(req.params.groupId).emit('expenseUpdated', expObj);
    res.json(expObj);
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message });
  }
};

// ── DELETE Expense ────────────────────────────────────────────────────────
exports.deleteExpense = async (req, res) => {
  try {
    const { groupId, expenseId } = req.params;

    const group = await Group.findById(groupId).select('owner').lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const exp = await Expense.findById(expenseId);
    if (!exp) return res.status(404).json({ message: 'Expense not found' });

    const isOwner = group.owner?.toString() === req.user._id.toString();
    const isCreator = exp.user?.toString() === req.user._id.toString();

    if (!isOwner && !isCreator) {
      return res.status(403).json({ message: 'Not authorized to delete this expense' });
    }

    await Expense.deleteOne({ _id: expenseId });

    const io = req.app.get('io');
    if (io) io.to(groupId).emit('expenseDeleted', { _id: exp._id });
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── DELETE All Expenses for a Month ─────────────────────────────────────────
exports.clearMonthExpenses = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { month } = req.query; // expected format: YYYY-MM

    if (!month || !/^\d{4}-\d{2}$/.test(month))
      return res.status(400).json({ message: 'month query param required (YYYY-MM)' });

    await assertMember(groupId, req.user._id);

    const result = await Expense.deleteMany({
      group: groupId,
      date: { $regex: `^${month}` },
    });

    const io = req.app.get('io');
    if (io) io.to(groupId).emit('expensesCleared', { groupId, month });

    res.json({ message: 'Cleared', deletedCount: result.deletedCount });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
