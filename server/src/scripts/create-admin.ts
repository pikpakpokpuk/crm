/**
 * Creates (or resets the password of) an admin user. Use this on a fresh
 * production database instead of the demo seed, which uses a well-known password.
 *
 * Usage: npm run admin:create -- <email> "<Full Name>" [password]
 * If no password is given, a strong random one is generated and printed once.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import prisma from '../prisma/client';

async function main() {
  const [email, name, passwordArg] = process.argv.slice(2);
  if (!email || !name) {
    console.error('Usage: npm run admin:create -- <email> "<Full Name>" [password]');
    process.exit(1);
  }
  if (passwordArg !== undefined && passwordArg.length < 10) {
    console.error('Password must be at least 10 characters.');
    process.exit(1);
  }

  const generated = passwordArg === undefined;
  const password = passwordArg ?? crypto.randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, name, role: 'ADMIN', active: true } });
    console.log(`Updated existing user ${email} (now an active ADMIN, password reset).`);
  } else {
    await prisma.user.create({ data: { email, name, passwordHash, role: 'ADMIN' } });
    console.log(`Created admin ${email}.`);
  }
  if (generated) console.log(`Generated password (shown once, change it after first login): ${password}`);
}

main()
  .catch((err) => { console.error('Failed:', err.message ?? err); process.exit(1); })
  .finally(() => prisma.$disconnect());
