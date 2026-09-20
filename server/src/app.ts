import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

// Set TRUST_PROXY=1 when running behind one reverse proxy (nginx/caddy) so
// rate limiting sees real client IPs instead of the proxy's.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || true);

app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:3000' }));
app.use(express.json());

app.use('/api', routes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

export default app;
