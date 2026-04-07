import type { Job } from 'bullmq';
import { prisma } from '@pasteking/db';
import { MinioStorageProvider } from '@pasteking/storage';
import { logger } from '../logger';
import { env } from '../env';
import type { PasteExpirationJobData } from '../queues';

function getObjectStorage(): MinioStorageProvider {
  return new MinioStorageProvider({
    endpoint: env.S3_ENDPOINT,
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
  });
}

export async function processExpiration(job: Job<PasteExpirationJobData>): Promise<void> {
  const { pasteId } = job.data;
  logger.info({ pasteId, jobId: job.id }, 'Processing paste expiration');

  const paste = await prisma.paste.findUnique({
    where: { id: pasteId },
  });

  if (!paste) {
    logger.warn({ pasteId }, 'Paste not found for expiration');
    return;
  }

  if (paste.status !== 'ACTIVE') {
    logger.info({ pasteId, status: paste.status }, 'Paste already inactive, skipping');
    return;
  }

  // Clean up object storage content if it exists
  if (paste.contentRef) {
    try {
      const storage = getObjectStorage();
      await storage.delete(paste.contentRef);
      logger.info({ pasteId, contentRef: paste.contentRef }, 'Object storage content deleted');
    } catch (err) {
      logger.error({ pasteId, contentRef: paste.contentRef, err }, 'Failed to delete object storage content');
    }
  }

  await prisma.paste.update({
    where: { id: pasteId },
    data: { status: 'EXPIRED', content: null, contentRef: null },
  });

  logger.info({ pasteId }, 'Paste expired successfully');
}
