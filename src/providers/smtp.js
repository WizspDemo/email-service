const nodemailer = require("nodemailer");

async function sendViaSmtp(cfg, { to, subject, body }) {
  const { host, port, secure, user, pass } = cfg.smtp;
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: !!secure,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: cfg.fromAddress || user,
    to,
    subject,
    html: body,
  });

  return { messageId: info.messageId };
}

module.exports = { sendViaSmtp };
