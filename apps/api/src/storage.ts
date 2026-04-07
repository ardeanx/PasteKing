import { MinioStorageProvider, HybridStorageProvider } from '@pasteking/storage';
import { env } from './env';

let hybridStorage: HybridStorageProvider | null = null;

export function getStorage(): HybridStorageProvider {
  if (!hybridStorage) {
    const minio = new MinioStorageProvider({
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
    });

    hybridStorage = new HybridStorageProvider({
      objectStorage: minio,
      sizeThreshold: env.STORAGE_THRESHOLD,
    });
  }
  return hybridStorage;
}
