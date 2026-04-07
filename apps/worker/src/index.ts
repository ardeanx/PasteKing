import './dotenv';
import { Worker } from 'bullmq';
import { env } from './env';
import { logger } from './logger';
import { createRedisConnection } from './redis';
import { QUEUES } from './queues';
import { processExpiration } from './processors';

function bootstrap(): void {
  const connection = createRedisConnection();

  const expirationWorker = new Worker(QUEUES.PASTE_EXPIRATION, processExpiration, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
  });

  expirationWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id, queue: QUEUES.PASTE_EXPIRATION }, 'Job completed');
  });

  expirationWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, queue: QUEUES.PASTE_EXPIRATION, err }, 'Job failed');
  });

  logger.info(
    {
      concurrency: env.WORKER_CONCURRENCY,
      queues: Object.values(QUEUES),
      env: env.NODE_ENV,
    },
    'PasteKing Worker started',
  );

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down worker...');
    await expirationWorker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
