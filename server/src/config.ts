import 'dotenv/config';

const PLACEHOLDER_SECRETS = ['change-this-to-a-long-random-string', 'secret', 'changeme'];

// Fails fast in production on unsafe config; only warns in development.
export function validateConfig() {
  const isProd = process.env.NODE_ENV === 'production';
  const problems: string[] = [];

  const jwt = process.env.JWT_SECRET;
  if (!jwt) problems.push('JWT_SECRET is not set');
  else if (PLACEHOLDER_SECRETS.includes(jwt) || jwt.length < 32) {
    problems.push('JWT_SECRET is a placeholder or shorter than 32 characters');
  }

  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set');

  if (isProd) {
    if (!process.env.CLIENT_URL) problems.push('CLIENT_URL is not set (required in production for CORS)');
    const enc = process.env.ENCRYPTION_KEY;
    if (!enc || enc.length < 32) problems.push('ENCRYPTION_KEY is not set or shorter than 32 characters');
  }

  if (problems.length === 0) return;
  const list = problems.map((p) => `  - ${p}`).join('\n');
  if (isProd) {
    throw new Error(`Refusing to start with unsafe configuration:\n${list}`);
  }
  console.warn(`[config] Unsafe configuration (would refuse to start in production):\n${list}`);
}
