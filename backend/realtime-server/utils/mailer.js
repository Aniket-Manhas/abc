const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn('⚠️ SMTP not configured, skipping email.');
    return;
  }

  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: port === 465, 
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const fromName = process.env.FROM_NAME || 'Sahyatri Alerts';
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: options.email,
    subject: options.subject,
    text: options.message
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email sent: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Email error: ${err.message}`);
  }
};

module.exports = sendEmail;
