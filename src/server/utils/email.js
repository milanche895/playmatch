const axios = require('axios');

async function sendTransactionalEmail({ to, toName, subject, htmlContent, textContent, tag }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Plejko';

  if (!apiKey || !senderEmail) {
    const err = new Error('Brevo nije konfigurisan (BREVO_API_KEY / BREVO_SENDER_EMAIL)');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to, ...(toName ? { name: toName } : {}) }],
      subject,
      htmlContent,
      textContent,
      tags: tag ? [tag] : undefined,
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 15000,
    }
  );
}

module.exports = { sendTransactionalEmail };
