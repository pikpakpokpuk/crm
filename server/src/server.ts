import app from './app';
import prisma from './prisma/client';
import { whatsappService } from './services/whatsapp.service';

const PORT = parseInt(process.env.PORT ?? '5000');

async function main() {
  await prisma.$connect();
  console.log('Database connected');

  whatsappService.initialize();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

const gracefulShutdown = async () => {
  console.log('Shutting down…');
  await whatsappService.destroy().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
