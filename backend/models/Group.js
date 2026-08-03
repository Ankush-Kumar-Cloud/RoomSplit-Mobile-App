const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  owner:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  inviteCode: { type: String, required: true, unique: true, uppercase: true },
}, { timestamps: true });

// ── Indexes ──────────────────────────────────────────────────────────────────
// This is the most critical index: every HomeScreen load queries this.
// MongoDB will use this index to instantly find all groups a user belongs to.
groupSchema.index({ members: 1 });

groupSchema.pre('save', function (next) {
  const ownerId = this.owner.toString();
  if (!this.members.some(m => m.toString() === ownerId)) {
    this.members.push(this.owner);
  }
  next();
});

module.exports = mongoose.model('Group', groupSchema);
