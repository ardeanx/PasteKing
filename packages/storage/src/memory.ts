import type { StorageProvider } from './interfaces';

/**
 * In-memory storage provider for local development and testing.
 * In the starter phase, paste content is stored directly in the database.
 * This provider serves as a reference implementation of the StorageProvider interface.
 *
 * TODO: Replace with S3StorageProvider for production deployments
 */
export class MemoryStorageProvider implements StorageProvider {
  private store = new Map<string, string>();

  async put(key: string, content: string | Buffer): Promise<void> {
    this.store.set(key, typeof content === 'string' ? content : content.toString('utf-8'));
  }

  async get(key: string): Promise<string> {
    const value = this.store.get(key);
    if (value === undefined) {
      throw new Error(`Storage key not found: ${key}`);
    }
    return value;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}
