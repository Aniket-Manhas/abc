const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn('⚠️ SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in env vars.');
    return { success: false, error: 'SMTP not configured' };
  }

  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    // Helps with some cloud provider network issues
    tls: {
      rejectUnauthorized: false
    }
  });

  const fromName = process.env.FROM_NAME || 'Sahyatri Alerts';
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || `<pre style="font-family:sans-serif">${options.message}</pre>`
  };

  try {
    // Verify connection first
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email sent to ${options.email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email error (host: ${process.env.SMTP_HOST}, port: ${port}, user: ${process.env.SMTP_USER}): ${err.message}`);
    return { success: false, error: err.message };
  }
};

module.exports = sendEmail;
