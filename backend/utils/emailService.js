const nodemailer = require('nodemailer');

// ── High-Speed Email Transporter Setup ──────────────────────────────────────
// Optimized with SSL (port 465), connection pooling, and high priority headers
// to ensure instant delivery without STARTTLS negotiation delays.

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const smtpHost  = process.env.SMTP_HOST;
  const smtpPort  = process.env.SMTP_PORT;

  if (emailUser && emailPass) {
    if (smtpHost) {
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort) || 587,
        secure: Number(smtpPort) === 465,
        pool: true,
        maxConnections: 3,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
    } else {
      // Use direct SSL on port 465 with connection pooling for maximum speed with Gmail
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // Direct SSL is significantly faster than STARTTLS on port 587
        pool: true,   // Keep socket warm to avoid recurring handshake latencies
        maxConnections: 3,
        maxMessages: 100,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
    }
  }

  return transporter;
};

/**
 * Send 6-digit OTP email with high-priority transactional headers
 * @param {string} toEmail 
 * @param {string} otp 
 * @param {string} userName 
 */
async function sendOtpEmail(toEmail, otp, userName = 'User') {
  const mailTransporter = getTransporter();
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'SplitMate <no-reply@splitmate.app>';

  // HTML email template
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SplitMate Verification Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f9fa; margin: 0; padding: 20px; color: #18181A; }
        .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #eaeaea; }
        .header { background: linear-gradient(135deg, #1AAD7D 0%, #16936A 100%); padding: 32px 24px; text-align: center; }
        .logo { font-size: 32px; font-weight: 800; color: #ffffff; margin: 0; }
        .content { padding: 32px 28px; text-align: center; }
        .greeting { font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #222225; }
        .desc { font-size: 14px; color: #65656A; line-height: 1.5; margin-bottom: 24px; }
        .otp-box { background: #F0FDF4; border: 2px dashed #1AAD7D; border-radius: 12px; padding: 18px 24px; display: inline-block; margin-bottom: 24px; }
        .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1AAD7D; font-family: 'Courier New', monospace; margin: 0; }
        .expiry { font-size: 13px; color: #8C8C94; margin-top: 6px; }
        .footer { background: #fafafa; border-top: 1px solid #f0f0f0; padding: 20px; font-size: 12px; color: #9898A0; text-align: center; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">₹ SplitMate</div>
        </div>
        <div class="content">
          <div class="greeting">Hello, ${userName}</div>
          <div class="desc">
            You requested a verification code to authenticate, log in, or reset your password on SplitMate.
          </div>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="expiry">Expires in 10 minutes</div>
          </div>
          <div class="desc" style="font-size: 13px; margin-bottom: 0;">
            Use this code in the app to complete your authentication or login.
            <br><strong>Never share this code with anyone.</strong>
          </div>
        </div>
        <div class="footer">
          If you did not request this OTP, you can safely ignore this email.<br>
          © 2026 SplitMate. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `Your SplitMate verification code is: ${otp}. It expires in 10 minutes. If you did not request this, please ignore.`;

  if (!mailTransporter) {
    // Development / Demo Mode: Log directly to terminal
    console.log('\n======================================================');
    console.log('📧 [DEV EMAIL SIMULATOR] (Configure EMAIL_USER & EMAIL_PASS in .env to send real emails)');
    console.log(`➡️  To: ${toEmail}`);
    console.log(`🔑 OTP Code: ${otp}`);
    console.log('⏰ Expiration: 10 minutes');
    console.log('======================================================\n');
    return { success: true, simulated: true };
  }

  try {
    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `Your SplitMate Verification Code: ${otp}`,
      text: textContent,
      html: htmlContent,
      priority: 'high',
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
      },
    });
    console.log(`[Email] OTP sent to ${toEmail} - MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email Error] Failed to send email via SMTP:', error.message);
    console.log(`🔑 DEV FALLBACK OTP for ${toEmail}: ${otp}`);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

module.exports = { sendOtpEmail };
