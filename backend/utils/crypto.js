const crypto = require('crypto');

// AES-256-GCM utilities for encrypting sensitive strings (e.g., email passwords)
// Requires process.env.EMAIL_CRED_KEY (32 bytes when decoded). You can provide:
// - 32-char UTF-8 key, or
// - base64 string that decodes to 32 bytes.

function getKey() {
  const raw = process.env.EMAIL_CRED_KEY || '';
  if (!raw) throw new Error('EMAIL_CRED_KEY is not set');

  // Try base64 decode first; fallback to utf-8 bytes
  let key;
  try {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
  } catch (_) {}

  const utf8 = Buffer.from(raw, 'utf-8');
  if (utf8.length === 32) return utf8;

  // If not 32 bytes, derive with SHA-256
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plainText) {
  if (plainText == null) return '';
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as base64(iv).base64(tag).base64(cipher)
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

function decrypt(payload) {
  if (!payload) return '';
  const key = getKey();
  const parts = String(payload).split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const data = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

module.exports = { encrypt, decrypt };
