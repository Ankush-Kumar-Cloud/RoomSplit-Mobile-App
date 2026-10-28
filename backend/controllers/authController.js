const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../utils/emailService');

// ── Signup ────────────────────────────────────────────────────────────────
exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim())           return res.status(400).json({ message: 'Name is required' });
    if (!email?.trim())          return res.status(400).json({ message: 'Email is required' });
    if (!password || password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ email: email.toLowerCase() }).lean();
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user         = await User.create({ name: name.trim(), email, password });
    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token on user doc for validation later
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(201).json({ token: accessToken, refreshToken, user: user.toPublic() });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── Login ─────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({ token: accessToken, refreshToken, user: user.toPublic() });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── Forgot Password (Send OTP to Email) ───────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetOtp = otp;
    user.resetOtpExpires = expiresAt;
    await user.save({ validateBeforeSave: false });

    await sendOtpEmail(user.email, otp, user.name);

    res.json({ message: 'Verification code sent to your email.' });
  } catch (e) {
    console.error('Forgot password error:', e);
    res.status(500).json({ message: e.message || 'Error sending verification code' });
  }
};

// ── Verify OTP & Login with OTP ───────────────────────────────────────────
exports.verifyOtpLogin = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email?.trim() || !otp?.trim()) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() })
      .select('+resetOtp +resetOtpExpires');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({ message: 'No active OTP request. Please request a new code.' });
    }

    if (Date.now() > new Date(user.resetOtpExpires).getTime()) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    if (user.resetOtp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid verification code. Please check and try again.' });
    }

    // Clear OTP fields
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      token: accessToken,
      refreshToken,
      user: user.toPublic(),
      message: 'Logged in successfully with OTP',
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Reset Password with OTP ───────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email?.trim() || !otp?.trim() || !newPassword) {
      return res.status(400).json({ message: 'Email, verification code, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() })
      .select('+resetOtp +resetOtpExpires +password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({ message: 'No active OTP request. Please request a new code.' });
    }

    if (Date.now() > new Date(user.resetOtpExpires).getTime()) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    if (user.resetOtp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid verification code. Please check and try again.' });
    }

    // Set new password (pre-save hook will hash it with bcrypt 12 rounds)
    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save(); // Full save to trigger pre-save hashing

    res.json({
      token: accessToken,
      refreshToken,
      user: user.toPublic(),
      message: 'Password reset successfully! You are now logged in.',
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Change Password (Authenticated User) ──────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── Refresh Token ─────────────────────────────────────────────────────────
// The frontend calls this silently when it receives a 401 TOKEN_EXPIRED error.
// This returns a new access token without requiring the user to login again.
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' });

    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + '_refresh';
    const decoded = jwt.verify(refreshToken, secret);

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const newAccessToken  = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (e) {
    res.status(401).json({ message: 'Refresh token expired or invalid. Please login again.' });
  }
};

// ── Logout ─────────────────────────────────────────────────────────────────
exports.logoutUser = async (req, res) => {
  try {
    // Invalidate the refresh token in DB — this is production-grade logout
    if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    }
    res.json({ message: 'Logged out' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── Get Me ─────────────────────────────────────────────────────────────────
exports.getMe = (req, res) => res.json({ user: req.user.toPublic() });

// ── Update Me ──────────────────────────────────────────────────────────────
exports.updateMe = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name required' });

    // findByIdAndUpdate is faster than find + save for simple field updates
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim() },
      { new: true, runValidators: true }
    ).lean();

    res.json({ user: { _id: user._id, name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── Register Push Token ───────────────────────────────────────────────────
exports.registerPushToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token required' });

    // Use $addToSet to avoid duplicate tokens for the same user
    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { fcmTokens: token } }
    );
    res.json({ message: 'Token registered successfully' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
