/** 
 * Browser-side E2E encryption for PasteKing.
 * Uses Web Crypto API with AES-256-GCM.
 *
 * The symmetric key is generated per-paste and NEVER sent to the server.
 * It lives only in the URL fragment (hash).
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
export const ENCRYPTION_VERSION = 1;

export interface EncryptedPayload {
  ciphertext: string; // base64-encoded ciphertext
  iv: string;         // base64-encoded IV
  version: number;    // algorithm version
}

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API is not available');
}

function getRandomValues(length: number): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(length);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a random AES-256-GCM key for a single paste.
 */
export async function generatePasteKey(): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  return subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable — we need to export it for the URL fragment
    ['encrypt', 'decrypt'],
  );
}

/**
 * Export a CryptoKey to a URL-safe base64 string for the URL fragment.
 */
export async function exportKeyToFragment(key: CryptoKey): Promise<string> {
  const subtle = getSubtleCrypto();
  const raw = await subtle.exportKey('raw', key);
  const b64 = uint8ToBase64(new Uint8Array(raw));
  // Make URL-safe: replace + with -, / with _, remove =
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Import a key from a URL fragment string.
 */
export async function importKeyFromFragment(fragment: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  // Reverse URL-safe base64
  let b64 = fragment.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const raw = base64ToUint8(b64);
  return subtle.importKey(
    'raw',
    raw,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt plaintext content using AES-256-GCM.
 * Returns ciphertext, IV (both base64), and the version number.
 */
export async function encryptContent(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  const subtle = getSubtleCrypto();
  const iv = getRandomValues(IV_LENGTH);
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuf = await subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );

  return {
    ciphertext: uint8ToBase64(new Uint8Array(ciphertextBuf)),
    iv: uint8ToBase64(iv),
    version: ENCRYPTION_VERSION,
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * Returns the original plaintext string.
 */
export async function decryptContent(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<string> {
  if (payload.version !== ENCRYPTION_VERSION) {
    throw new Error(`Unsupported encryption version: ${payload.version}`);
  }

  const subtle = getSubtleCrypto();
  const iv = base64ToUint8(payload.iv);
  const ciphertext = base64ToUint8(payload.ciphertext);

  const plainBuf = await subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plainBuf);
}