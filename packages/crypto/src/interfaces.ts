/**
 * Encryption interface for future client-side encryption support.
 *
 * TODO: Implement AES-GCM encryption with Web Crypto API
 * TODO: Support key derivation from passphrase (PBKDF2)
 * TODO: Support key wrapping for share links
 */

export interface EncryptionResult {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  salt: Uint8Array;
}

export interface CryptoProvider {
  encrypt(plaintext: string, passphrase: string): Promise<EncryptionResult>;
  decrypt(encrypted: EncryptionResult, passphrase: string): Promise<string>;
  generateKey(): Promise<unknown>;
  hash(data: string): Promise<string>;
}

export interface KeyMetadata {
  algorithm: string;
  keyLength: number;
  createdAt: Date;
}
