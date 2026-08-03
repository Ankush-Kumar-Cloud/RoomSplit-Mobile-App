const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

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
