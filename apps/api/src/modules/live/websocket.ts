import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { logger } from '../../logger';

interface Client {
  ws: WebSocket;
  pasteId: string;
  userId?: string;
  cursorPos?: { line: number; ch: number };
}

// Map of pasteId → Set<Client>
const rooms = new Map<string, Set<Client>>();

export function setupWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/v1/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const pasteId = url.searchParams.get('pasteId');

    if (!pasteId) {
      ws.close(4000, 'Missing pasteId parameter');
      return;
    }

    const client: Client = { ws, pasteId };

    // Add to room
    if (!rooms.has(pasteId)) {
      rooms.set(pasteId, new Set());
    }
    rooms.get(pasteId)!.add(client);

    const roomSize = rooms.get(pasteId)!.size;
    logger.debug({ pasteId, roomSize }, 'WebSocket client connected');

    // Send current room info
    ws.send(
      JSON.stringify({
        type: 'room_info',
        pasteId,
        activeUsers: roomSize,
      }),
    );

    // Broadcast join to others
    broadcast(pasteId, client, {
      type: 'user_joined',
      activeUsers: roomSize,
    });

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'edit': {
            // Broadcast content edit to others
            broadcast(pasteId, client, {
              type: 'edit',
              content: typeof msg.content === 'string' ? msg.content : '',
              from: msg.from,
            });
            break;
          }
          case 'cursor': {
            // Broadcast cursor position
            client.cursorPos = msg.pos;
            broadcast(pasteId, client, {
              type: 'cursor',
              userId: client.userId,
              pos: msg.pos,
            });
            break;
          }
          case 'identify': {
            client.userId = typeof msg.userId === 'string' ? msg.userId : undefined;
            break;
          }
          default:
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      const room = rooms.get(pasteId);
      if (room) {
        room.delete(client);
        const newSize = room.size;
        if (newSize === 0) {
          rooms.delete(pasteId);
        } else {
          broadcast(pasteId, client, {
            type: 'user_left',
            activeUsers: newSize,
          });
        }
      }
    });

    ws.on('error', () => {
      const room = rooms.get(pasteId);
      if (room) {
        room.delete(client);
        if (room.size === 0) rooms.delete(pasteId);
      }
    });
  });

  logger.info('WebSocket server attached at /v1/ws');
}

function broadcast(pasteId: string, sender: Client, msg: Record<string, unknown>): void {
  const room = rooms.get(pasteId);
  if (!room) return;
  const data = JSON.stringify(msg);
  for (const client of room) {
    if (client !== sender && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}
