const mongoose = require('mongoose');

// ── Payment Schema (Actual peer-to-peer cash / UPI transfers) ────────────────
const paymentSchema = new mongoose.Schema({
  group:       { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  from:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:      { type: Number, required: true, min: 0.01 }, // in Rupees e.g. 50.00
  amountPaise: { type: Number, required: true, min: 1 },    // in Integer Paise e.g. 5000
  date:        { type: String, required: true },             // YYYY-MM-DD
  status:      { type: String, enum: ['confirmed', 'pending'], default: 'confirmed' },
  note:        { type: String, default: '', trim: true },
  settlementCycle: { type: mongoose.Schema.Types.ObjectId, ref: 'SettlementCycle', default: null },
}, { timestamps: true });

// Indexes for fast lookups
paymentSchema.index({ group: 1, settlementCycle: 1 });
paymentSchema.index({ group: 1, from: 1 });
paymentSchema.index({ group: 1, to: 1 });

// ── SettlementCycle Schema (Historical Completed Settlements) ────────────────
const settlementCycleSchema = new mongoose.Schema({
  group:       { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  title:       { type: String, default: 'Settlement', trim: true },
  status:      { type: String, enum: ['pending', 'completed'], default: 'completed' },
  settledAt:   { type: Date, default: Date.now },
  settledBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  totalExpensesPaise: { type: Number, default: 0 },
  totalPaymentsPaise: { type: Number, default: 0 },
  
  // Historical snapshot of member shares & balances at the moment of completion
  memberBalances: [{
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name:         { type: String },
    paidPaise:    { type: Number, default: 0 },
    sharePaise:   { type: Number, default: 0 },
    netPaise:     { type: Number, default: 0 },
  }],

  // Final settlement transactions agreed upon
  transactions: [{
    from:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromName:     { type: String },
    to:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    toName:       { type: String },
    amountPaise:  { type: Number },
    amountRupees: { type: Number },
  }],
}, { timestamps: true });

settlementCycleSchema.index({ group: 1, settledAt: -1 });

module.exports = {
  Payment: mongoose.model('Payment', paymentSchema),
  SettlementCycle: mongoose.model('SettlementCycle', settlementCycleSchema),
};

