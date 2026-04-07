import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export interface PasteExpirationJobData {
  pasteId: string;
}

let expirationQueue: Queue<PasteExpirationJobData> | null = null;

export function getExpirationQueue(): Queue<PasteExpirationJobData> {
  if (!expirationQueue) {
    expirationQueue = new Queue<PasteExpirationJobData>('paste-expiration', {
      connection: getConnection(),
    });
  }
  return expirationQueue;
}

export async function enqueueExpiration(pasteId: string, delayMs: number): Promise<void> {
  await getExpirationQueue().add(
    'expire',
    { pasteId },
    {
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
}
