const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── Token Helpers ─────────────────────────────────────────────────────────
// Access token: short-lived (15m). Used for API calls. Kept in memory.
// Refresh token: long-lived (7d). Used to obtain new access tokens.
// This is the industry standard. If an access token is stolen, it expires fast.

const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });

const generateRefreshToken = (id) =>
  jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET + '_refresh', { expiresIn: '7d' });

// ── Auth Middleware ─────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorised — no token' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    // Use lean() here — we only need user data for auth checks, not Mongoose docs
    req.user = await User.findById(decoded.id).select('-password').lean();
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    // Mongoose lean() returns plain objects — we need to add toPublic manually
    req.user.toPublic = () => ({ _id: req.user._id, name: req.user.name, email: req.user.email });
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ message: 'Token invalid' });
  }
};

module.exports = { protect, generateAccessToken, generateRefreshToken };
