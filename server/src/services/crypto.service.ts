import crypto from 'crypto';

const PREFIX = 'enc:v1:';

// Key comes from ENCRYPTION_KEY; falls back to JWT_SECRET in development only
// (production config validation requires ENCRYPTION_KEY to be set).
function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!secret) throw new Error('ENCRYPTION_KEY is not set');
  return crypto.createHash('sha256').update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, data]).toString('base64');
}

// Values without the prefix are treated as legacy plaintext.
export function decrypt(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
