import { createServer } from 'http';
import App from './app';
import socketService from './lib/socket';

const app = new App();
const httpServer = createServer(app.express);

// Initialize Socket.io with Redis adapter (async for horizontal scaling setup)
(async () => {
  await socketService.initialize(httpServer);
})().catch((e) => {
  console.error('Failed to initialize Socket.io:', e);
});

// Connect Prisma
app.connectPrisma().catch((e) => {
  throw e;
});

// Graceful shutdown handler
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  await socketService.shutdown();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default httpServer;

