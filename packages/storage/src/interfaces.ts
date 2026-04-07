/**
 * Storage abstraction for paste content.
 *
 * TODO: Implement S3StorageProvider using @aws-sdk/client-s3
 * TODO: Implement MinIO-compatible storage for local development
 * TODO: Add streaming support for large pastes
 * TODO: Add presigned URL generation for direct uploads
 */

export interface StorageProvider {
  put(key: string, content: string | Buffer): Promise<void>;
  get(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface StorageMetadata {
  key: string;
  size: number;
  contentType: string;
  createdAt: Date;
}
