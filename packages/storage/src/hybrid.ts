import type { StorageProvider } from './interfaces';

/**
 * Content below this threshold is stored inline in the database.
 * Content above it goes to object storage (MinIO/S3).
 * Default: 64KB
 */
export const DEFAULT_SIZE_THRESHOLD = 64 * 1024;

export interface HybridStorageConfig {
  objectStorage: StorageProvider;
  sizeThreshold?: number;
}

export type StorageBackend = 'db' | 'object';

export interface StorageDecision {
  backend: StorageBackend;
  /** The content if stored in DB (backend === 'db'), null for object storage */
  dbContent: string | null;
  /** The object storage key if stored in object storage, null for DB */
  contentRef: string | null;
}

export class HybridStorageProvider {
  private objectStorage: StorageProvider;
  private sizeThreshold: number;

  constructor(config: HybridStorageConfig) {
    this.objectStorage = config.objectStorage;
    this.sizeThreshold = config.sizeThreshold ?? DEFAULT_SIZE_THRESHOLD;
  }

  /**
   * Decide where to store content and persist if going to object storage.
   * Returns the storage decision so the caller can set DB fields accordingly.
   */
  async store(key: string, content: string): Promise<StorageDecision> {
    const size = Buffer.byteLength(content, 'utf-8');

    if (size <= this.sizeThreshold) {
      return { backend: 'db', dbContent: content, contentRef: null };
    }

    await this.objectStorage.put(key, content);
    return { backend: 'object', dbContent: null, contentRef: key };
  }

  /**
   * Retrieve content from whichever backend it lives in.
   * @param dbContent - The content column from the database (null if stored in object storage)
   * @param contentRef - The object storage key (null if stored in database)
   */
  async retrieve(dbContent: string | null, contentRef: string | null): Promise<string> {
    if (dbContent !== null) {
      return dbContent;
    }
    if (contentRef) {
      return this.objectStorage.get(contentRef);
    }
    return '';
  }

  /**
   * Delete content from object storage if it exists there.
   */
  async remove(contentRef: string | null): Promise<void> {
    if (contentRef) {
      await this.objectStorage.delete(contentRef);
    }
  }
}
