const mongoose = require('mongoose');

// ── User Model ─────────────────────────────────────────────────────────────
// Added: refreshToken and fcmTokens fields for production auth and push notifications.
// The 'select: false' ensures these sensitive fields are NEVER returned in API
// responses unless explicitly requested with .select('+refreshToken').

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, minlength: 6, select: false },
  // Refresh token for JWT rotation — stored hashed for security
  refreshToken: { type: String, select: false },
  // Array of FCM device tokens for push notifications
  // A user can be logged in on multiple devices simultaneously
  fcmTokens:    { type: [String], default: [], select: false },
}, { timestamps: true });

// ── Pre-save hook to hash passwords ────────────────────────────────────────
const bcrypt = require('bcryptjs');
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12); // Upgraded from 10 to 12 rounds
  next();
});

// ── Instance Methods ────────────────────────────────────────────────────────
userSchema.methods.matchPassword = function (plain) {
  return require('bcryptjs').compare(plain, this.password);
};

userSchema.methods.toPublic = function () {
  return { _id: this._id, name: this.name, email: this.email };
};

module.exports = mongoose.model('User', userSchema);
