const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  group:           { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  user:            { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  item:            { type: String, required: true, trim: true },
  amount:          { type: Number, required: true, min: 0.01 },
  date:            { type: String, required: true }, // YYYY-MM-DD
  note:            { type: String, default: '', trim: true },
  category:        { type: String, enum: ['food','rent','util','grocery','transport','health','fun','other'], default: 'other' },
  recurring:       { type: Boolean, default: false },
  splitType:       { type: String, enum: ['equal','custom','payer'], default: 'equal' },
  splitWeights:    { type: Map, of: Number, default: {} },
  // Array of member ObjectIds who did NOT consume this expense
  excludedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  // Reference to completed settlement cycle (null = currently pending in active settlement)
  settlementCycle: { type: mongoose.Schema.Types.ObjectId, ref: 'SettlementCycle', default: null },
}, { timestamps: true });

// ── Indexes ──────────────────────────────────────────────────────────────────
// Compound index for pending vs settled expense filtering inside a group.
expenseSchema.index({ group: 1, settlementCycle: 1 });

// Compound index for cursor-based pagination on the expense list page.
expenseSchema.index({ group: 1, _id: -1 });

// Compound index for filtered queries (by date or month range).
expenseSchema.index({ group: 1, date: 1 });

// Compound index for per-user expense history inside a group.
expenseSchema.index({ group: 1, user: 1 });

// Compound index for category filter within a group.
expenseSchema.index({ group: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
