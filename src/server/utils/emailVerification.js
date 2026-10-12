const crypto = require('crypto');
const { sendTransactionalEmail } = require('./email');
const { getPublicUrl } = require('../publicUrl');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function isEmailVerified(user) {
  if (!user) return false;
  if (user.emailVerified) return true;
  // Google / Facebook / Instagram — provider already verified the identity
  return user.provider && user.provider !== 'local';
}

function hashVerificationToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function createVerificationToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return {
    rawToken,
    hash: hashVerificationToken(rawToken),
    expires: new Date(Date.now() + TOKEN_TTL_MS),
  };
}

function buildVerificationEmail(name, verifyUrl) {
  const safeName = name || 'tamo';
  return {
    subject: 'Potvrdi email — Plejko',
    textContent: [
      `Zdravo ${safeName},`,
      '',
      'Potvrdi svoj email nalog na Plejku klikom na link:',
      verifyUrl,
      '',
      'Link važi 24 sata. Ako nisi ti zahtevao ovo, ignoriši poruku.',
    ].join('\n'),
    htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px;color:#16a34a">Potvrdi svoj email</h2>
        <p style="margin:0 0 16px;line-height:1.5">Zdravo ${safeName}, klikni na dugme da potvrdiš nalog na Plejku.</p>
        <p style="margin:0 0 24px">
          <a href="${verifyUrl}" style="display:inline-block;background:#22c55e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">
            Potvrdi email
          </a>
        </p>
        <p style="margin:0 0 8px;font-size:14px;color:#475569">Ako dugme ne radi, otvori ovaj link:</p>
        <p style="margin:0 0 24px;font-size:13px;word-break:break-all">
          <a href="${verifyUrl}" style="color:#16a34a">${verifyUrl}</a>
        </p>
        <p style="margin:0;font-size:13px;color:#64748b">Link važi 24 sata. Ako nisi ti zahtevao ovo, ignoriši poruku.</p>
      </div>
    `,
  };
}

async function issueAndSendVerificationEmail(user, req) {
  const { rawToken, hash, expires } = createVerificationToken();
  user.emailVerifyTokenHash = hash;
  user.emailVerifyExpires = expires;
  await user.save();

  const verifyUrl = `${getPublicUrl(req)}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const email = buildVerificationEmail(user.name, verifyUrl);

  await sendTransactionalEmail({
    to: user.email,
    toName: user.name,
    subject: email.subject,
    htmlContent: email.htmlContent,
    textContent: email.textContent,
    tag: 'email-verification',
  });

  user.emailVerifySentAt = new Date();
  await user.save();
}

module.exports = {
  isEmailVerified,
  hashVerificationToken,
  createVerificationToken,
  issueAndSendVerificationEmail,
  RESEND_COOLDOWN_MS,
};
