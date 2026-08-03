const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  group:    { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  monthKey: { type: String, required: true }, // YYYY-MM
  amount:   { type: Number, required: true, min: 0 },
}, { timestamps: true });

budgetSchema.index({ group: 1, user: 1, monthKey: 1 }, { unique: true });

const settlementSchema = new mongoose.Schema({
  group:    { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  monthKey: { type: String, required: true },
  txnIndex: { type: Number, required: true },
  paid:     { type: Boolean, default: true },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

settlementSchema.index({ group: 1, monthKey: 1, txnIndex: 1 }, { unique: true });

module.exports = {
  Budget:     mongoose.model('Budget', budgetSchema),
  Settlement: mongoose.model('Settlement', settlementSchema),
};
