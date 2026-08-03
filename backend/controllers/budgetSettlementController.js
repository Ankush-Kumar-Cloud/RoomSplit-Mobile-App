const { Budget, Settlement } = require('../models/BudgetSettlement');

exports.getBudgets = async (req, res) => {
  try {
    const filter = { group: req.params.groupId };
    if (req.query.month) filter.monthKey = req.query.month;
    res.json(await Budget.find(filter).populate('user', 'name email').lean());
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.upsertBudget = async (req, res) => {
  try {
    const { userId, monthKey, amount } = req.body;
    const budget = await Budget.findOneAndUpdate(
      { group: req.params.groupId, user: userId, monthKey },
      { amount: +amount || 0 },
      { upsert: true, new: true }
    ).populate('user', 'name email');
    const io = req.app.get('io');
    if (io) io.to(req.params.groupId).emit('budgetUpserted', budget);
    res.json(budget);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getSettlements = async (req, res) => {
  try {
    const filter = { group: req.params.groupId };
    if (req.query.month) filter.monthKey = req.query.month;
    res.json(await Settlement.find(filter).lean());
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.toggleSettlement = async (req, res) => {
  try {
    const { monthKey, txnIndex } = req.body;
    const existing = await Settlement.findOne({ group: req.params.groupId, monthKey, txnIndex });
    let record;
    if (existing) { existing.paid = !existing.paid; existing.markedBy = req.user._id; record = await existing.save(); }
    else { record = await Settlement.create({ group: req.params.groupId, monthKey, txnIndex, paid: true, markedBy: req.user._id }); }
    const io = req.app.get('io');
    if (io) io.to(req.params.groupId).emit('settlementToggled', record);
    res.json(record);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
