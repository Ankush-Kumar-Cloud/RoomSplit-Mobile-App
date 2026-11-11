const express = require('express');

const router = express.Router();

/**
 * Render a standalone branded HTML page for SplitMate public info & OAuth branding links.
 */
function renderPage(title, contentHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — SplitMate</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #F6F6F3;
      color: #111827;
      line-height: 1.6;
      padding: 32px 16px;
    }
    .container {
      max-width: 720px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 8px 24px rgba(17, 24, 39, 0.06);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 24px;
      padding-bottom: 18px;
      border-bottom: 1px solid #E5E7EB;
    }
    .logo {
      width: 48px;
      height: 48px;
      background: #1AAD7D;
      color: #FFFFFF;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 800;
    }
    h1 { font-size: 24px; font-weight: 800; color: #111827; }
    h2 { font-size: 18px; font-weight: 700; margin: 22px 0 8px; color: #111827; }
    p, li { font-size: 15px; color: #374151; margin-bottom: 10px; }
    ul { padding-left: 20px; margin-bottom: 14px; }
    .subtitle { font-size: 14px; color: #6B7280; }
    .nav {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid #E5E7EB;
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
      font-size: 14px;
    }
    a { color: #1AAD7D; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">&#8377;</div>
      <div>
        <h1>SplitMate</h1>
        <div class="subtitle">Smart Expense Sharing for Roommates</div>
      </div>
    </div>
    ${contentHtml}
    <div class="nav">
      <a href="/">Home</a>
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms of Service</a>
    </div>
  </div>
</body>
</html>`;
}

router.get('/', (_req, res) => {
  res.type('html').send(
    renderPage(
      'Home',
      `<h2>Welcome to SplitMate</h2>
       <p><strong>SplitMate</strong> helps roommates and shared households track daily expenses, exclude non-participating members cleanly, and settle balances fairly in real time.</p>
       <h2>Key Features</h2>
       <ul>
         <li><strong>Fair Splitting & Smart Exclusion:</strong> Split room expenses accurately and exclude members who did not share specific items.</li>
         <li><strong>Real-Time Sync:</strong> Live updates across group members' mobile devices.</li>
         <li><strong>Easy Settlements:</strong> Track pending balances, record partial payments, and close settlement cycles transparently.</li>
       </ul>
       <p>Contact support: <a href="mailto:ankushkumary77@gmail.com">ankushkumary77@gmail.com</a></p>`
    )
  );
});

router.get('/privacy', (_req, res) => {
  res.type('html').send(
    renderPage(
      'Privacy Policy',
      `<h2>Privacy Policy</h2>
       <p>Last updated: November 2026</p>
       <p>SplitMate respects your privacy and only collects the minimum data required to provide shared expense tracking among your roommate groups.</p>
       <h2>Information We Collect</h2>
       <ul>
         <li><strong>Google Account Profile Data:</strong> When you choose to sign in with Google, we receive your name, email address, Google user ID, and optional profile photo via standard Google OAuth scopes (<code>email</code> and <code>profile</code>).</li>
         <li><strong>Expense & Group Records:</strong> Group memberships, shared expenses, and settlement records you create within SplitMate.</li>
       </ul>
       <h2>How We Use Your Data</h2>
       <ul>
         <li>To authenticate your SplitMate account securely and display your identity to your roommate group members.</li>
         <li>We never sell, rent, or share your personal data or Google user data with third-party advertisers.</li>
       </ul>
       <h2>Data Deletion & Contact</h2>
       <p>To request account or data deletion, contact <a href="mailto:ankushkumary77@gmail.com">ankushkumary77@gmail.com</a>.</p>`
    )
  );
});

router.get('/terms', (_req, res) => {
  res.type('html').send(
    renderPage(
      'Terms of Service',
      `<h2>Terms of Service</h2>
       <p>By using the SplitMate mobile application, you agree to use the service responsibly for recording shared household expenses and settlements.</p>
       <ul>
         <li>You are responsible for the accuracy of expenses and payments you log in your groups.</li>
         <li>SplitMate provides calculation and record-keeping tools and does not process direct bank transfers.</li>
       </ul>
       <p>For questions, contact <a href="mailto:ankushkumary77@gmail.com">ankushkumary77@gmail.com</a>.</p>`
    )
  );
});

module.exports = router;
