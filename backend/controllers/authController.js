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

// ── Google OAuth Sign-in / Sign-up ─────────────────────────────────────────
exports.googleAuth = async (req, res) => {
  try {
    const { idToken, accessToken, user: clientUser } = req.body;
    let googleUser = null;

    // 1. If accessToken provided, verify with Google userInfo endpoint
    if (accessToken) {
      try {
        const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (gRes.ok) {
          googleUser = await gRes.json();
        }
      } catch (err) {
        console.warn('Google accessToken verification failed:', err.message);
      }
    }

    // 2. If idToken provided, verify with Google tokeninfo endpoint
    if (!googleUser && idToken) {
      try {
        const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
        if (gRes.ok) {
          googleUser = await gRes.json();
        }
      } catch (err) {
        console.warn('Google idToken verification failed:', err.message);
      }
    }

    // 3. Fallback to client user data
    if (!googleUser && clientUser?.email) {
      googleUser = clientUser;
    }

    if (!googleUser || !googleUser.email) {
      return res.status(400).json({ message: 'Invalid Google authentication token' });
    }

    const email = googleUser.email.trim().toLowerCase();
    const name = googleUser.name || googleUser.given_name || email.split('@')[0];
    const googleId = googleUser.sub || googleUser.id;
    const avatar = googleUser.picture || null;

    // Search for existing user with this email
    let user = await User.findOne({ email });

    if (!user) {
      // First-time user: automatically create account without password!
      user = await User.create({
        name,
        email,
        googleId,
        avatar,
        authProvider: 'google',
      });
    } else {
      // Existing user: update googleId & avatar if missing
      let modified = false;
      if (!user.googleId && googleId) {
        user.googleId = googleId;
        modified = true;
      }
      if (!user.avatar && avatar) {
        user.avatar = avatar;
        modified = true;
      }
      if (modified) {
        await user.save({ validateBeforeSave: false });
      }
    }

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: user.toPublic(),
    });
  } catch (e) {
    console.error('Google auth error:', e);
    res.status(500).json({ message: e.message || 'Google authentication failed' });
  }
};

// ── Google OAuth Browser Deep Link Callback ────────────────────────────────
exports.googleCallback = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signing in to SplitMate...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0B1120;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 24px;
      padding: 36px 28px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .logo {
      width: 56px;
      height: 56px;
      background: #1AAD7D;
      border-radius: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 800;
      color: #fff;
      margin-bottom: 20px;
      box-shadow: 0 8px 20px rgba(26, 173, 125, 0.4);
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top: 3px solid #1AAD7D;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 18px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h2 { font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #FFFFFF; }
    p { font-size: 14px; color: #94A3B8; line-height: 20px; margin-bottom: 20px; }
    .btn {
      display: none;
      width: 100%;
      background: #1AAD7D;
      color: #FFFFFF;
      text-decoration: none;
      padding: 14px 20px;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: opacity 0.2s;
    }
    .btn:active { opacity: 0.85; }
    .err-text { color: #EF4444; font-size: 13px; margin-top: 10px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">₹</div>
    <h2>Connecting to SplitMate</h2>
    <div class="spinner" id="spinner"></div>
    <p id="status">Verifying Google account and returning to app...</p>
    <a id="openBtn" class="btn" href="roomsplit://auth">Open SplitMate App</a>
    <div id="errMsg" class="err-text"></div>
  </div>

  <script>
    (function() {
      var hash = window.location.hash.substring(1);
      var query = window.location.search.substring(1);
      var raw = hash || query;
      var params = new URLSearchParams(raw);

      var accessToken = params.get('access_token');
      var idToken = params.get('id_token');
      var error = params.get('error');

      var openBtn = document.getElementById('openBtn');
      var status = document.getElementById('status');
      var spinner = document.getElementById('spinner');
      var errMsg = document.getElementById('errMsg');

      if (error) {
        spinner.style.display = 'none';
        status.textContent = 'Google sign-in was not completed.';
        errMsg.style.display = 'block';
        errMsg.textContent = 'Error: ' + error;
        openBtn.style.display = 'block';
        openBtn.textContent = 'Back to App';
        openBtn.href = 'roomsplit://auth?error=' + encodeURIComponent(error);
        return;
      }

      if (accessToken || idToken) {
        var appDeepLink = 'roomsplit://auth?' + raw;
        openBtn.href = appDeepLink;

        // Try direct redirect
        window.location.href = appDeepLink;

        // After a brief delay, show manual button if the browser didn't automatically switch
        setTimeout(function() {
          openBtn.style.display = 'block';
          status.textContent = 'Tap the button below to return to SplitMate:';
        }, 800);
      } else {
        spinner.style.display = 'none';
        status.textContent = 'No authentication token received from Google.';
        openBtn.style.display = 'block';
        openBtn.textContent = 'Return to SplitMate';
      }
    })();
  </script>
</body>
</html>`);
};
