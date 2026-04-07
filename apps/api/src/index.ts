import './dotenv';
import { createServer } from 'http';
import { env } from './env';
import { logger } from './logger';
import { createApp } from './app';
import { setupWebSocket } from './modules/live/websocket';

const app = createApp();
const server = createServer(app);

// Attach WebSocket for live collaboration
setupWebSocket(server);
server.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'PasteKing API started');
});
