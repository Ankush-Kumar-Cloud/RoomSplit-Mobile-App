const Expense = require('../models/Expense');
const Group   = require('../models/Group');
const { Expo } = require('expo-server-sdk');

const expo = new Expo();

// ── Helper: Verify group membership ────────────────────────────────────────
const assertMember = async (groupId, userId) => {
  // Use .lean() and select only members array — much faster than full doc
  const g = await Group.findById(groupId).select('members').lean();
  if (!g) throw Object.assign(new Error('Group not found'), { status: 404 });
  if (!g.members.some(m => m.toString() === userId.toString()))
    throw Object.assign(new Error('Not a member'), { status: 403 });
};

// ── GET Expenses with cursor-based pagination ──────────────────────────────
// WHY CURSOR PAGINATION?
//   Offset pagination (skip/limit) is O(n) — MongoDB must scan all skipped docs.
//   Cursor pagination is O(log n) — uses the index directly, no scanning.
//   At 10,000 expenses, offset page 100 takes ~10x longer than cursor.
//
// HOW IT WORKS:
//   Client sends `cursor=<lastExpenseId>`. Server finds all docs with _id < cursor.
//   The client gets `nextCursor` in the response and uses it for the next page.
exports.getExpenses = async (req, res) => {
  try {
    await assertMember(req.params.groupId, req.user._id);

    const { date, month, category, search, cursor, limit = 50 } = req.query;
    const filter = { group: req.params.groupId };

    // Cursor: fetch docs with _id less than the cursor (newer docs first)
    if (cursor) filter._id = { $lt: cursor };
    if (date)     filter.date = date;
    if (month)    filter.date = { $regex: `^${month}` };
    if (category) filter.category = category;
    if (search)   filter.$or = [
      { item: { $regex: search, $options: 'i' } },
      { note: { $regex: search, $options: 'i' } },
    ];

    const expenses = await Expense.find(filter)
      .populate('user', 'name email')
      .sort({ _id: -1 })
      .limit(Number(limit))
      .lean(); // Returns plain JS objects — 5x less memory than Mongoose docs

    res.json({
      data: expenses,
      // If we got a full page, there are likely more results
      nextCursor: expenses.length >= Number(limit) ? expenses[expenses.length - 1]._id : null,
    });
  } catch (e) { res.status(e.status || 500).json({ message: e.message }); }
};

// ── POST Create Expense ────────────────────────────────────────────────────
exports.createExpense = async (req, res) => {
  try {
    await assertMember(req.params.groupId, req.user._id);
    const { item, amount, date, note, category, recurring, splitType, splitWeights } = req.body;
    if (!item?.trim()) return res.status(400).json({ message: 'Item name required' });
    if (!amount || isNaN(amount) || +amount <= 0) return res.status(400).json({ message: 'Valid amount required' });
    if (!date) return res.status(400).json({ message: 'Date required' });

    const exp = await Expense.create({
      group: req.params.groupId, user: req.user._id,
      item: item.trim(), amount: +amount, date,
      note: note?.trim() || '', category: category || 'other',
      recurring: !!recurring, splitType: splitType || 'equal',
      splitWeights: splitWeights || {},
    });
    const populatedExp = await exp.populate('user', 'name email');
    const io = req.app.get('io');
    if (io) io.to(req.params.groupId).emit('expenseCreated', populatedExp);

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
        // Send asynchronously — don't block the API response
        expo.sendPushNotificationsAsync(chunk).catch(console.error);
      }
    } catch (pushErr) { console.error('Push Error:', pushErr); }

    res.status(201).json(populatedExp);
  } catch (e) { res.status(e.status || 500).json({ message: e.message }); }
};

// ── PUT Update Expense ────────────────────────────────────────────────────
exports.updateExpense = async (req, res) => {
  try {
    const { item, amount, date, note, category, recurring, splitType, splitWeights } = req.body;

    // Build the update object dynamically — only update provided fields
    const updates = {};
    if (item !== undefined)          updates.item = item.trim();
    if (amount !== undefined)        updates.amount = +amount;
    if (date !== undefined)          updates.date = date;
    if (note !== undefined)          updates.note = note.trim();
    if (category !== undefined)      updates.category = category;
    if (recurring !== undefined)     updates.recurring = recurring;
    if (splitType !== undefined)     updates.splitType = splitType;
    if (splitWeights !== undefined)  updates.splitWeights = splitWeights;

    // findByIdAndUpdate is a single DB round-trip vs find+modify+save (2 round-trips)
    const exp = await Expense.findOneAndUpdate(
      { _id: req.params.expenseId, user: req.user._id }, // Atomic ownership check
      updates,
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    if (!exp) return res.status(404).json({ message: 'Expense not found or not authorized' });
    const io = req.app.get('io');
    if (io) io.to(req.params.groupId).emit('expenseUpdated', exp);
    res.json(exp);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── DELETE Expense ────────────────────────────────────────────────────────
exports.deleteExpense = async (req, res) => {
  try {
    const { groupId, expenseId } = req.params;

    // Check if user is group owner or creator of expense
    const group = await Group.findById(groupId).select('owner').lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isOwner = group.owner?.toString() === req.user._id.toString();

    const query = { _id: expenseId, group: groupId };
    if (!isOwner) {
      // Non-owners can only delete their own expenses
      query.user = req.user._id;
    }

    const exp = await Expense.findOneAndDelete(query);
    if (!exp) return res.status(404).json({ message: 'Expense not found or not authorized' });

    const io = req.app.get('io');
    if (io) io.to(groupId).emit('expenseDeleted', { _id: exp._id });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── DELETE All Expenses for a Month ─────────────────────────────────────────
// Deletes every expense in the group whose date starts with YYYY-MM.
// Any group member can trigger this (can tighten to owner-only if preferred).
exports.clearMonthExpenses = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { month } = req.query; // expected format: YYYY-MM

    if (!month || !/^\d{4}-\d{2}$/.test(month))
      return res.status(400).json({ message: 'month query param required (YYYY-MM)' });

    await assertMember(groupId, req.user._id);

    // deleteMany is a single DB round-trip and uses the (group, date) index
    const result = await Expense.deleteMany({
      group: groupId,
      date: { $regex: `^${month}` },
    });

    const io = req.app.get('io');
    if (io) io.to(groupId).emit('expensesCleared', { groupId, month });

    res.json({ message: 'Cleared', deletedCount: result.deletedCount });
  } catch (e) { res.status(e.status || 500).json({ message: e.message }); }
};
