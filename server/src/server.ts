import { createServer } from 'http';
import App from './app';
import socketService from './lib/socket';

const app = new App();
const httpServer = createServer(app.express);

// Initialize Socket.io
socketService.initialize(httpServer);

// Connect Prisma
app.connectPrisma().catch((e) => {
  throw e;
});

export default httpServer;
