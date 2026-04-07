import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex');
}

export function generateId(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((b: number) => chars[b % chars.length])
    .join('');
}

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCKSIZE = 8;
const SCRYPT_PARALLELISM = 1;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCKSIZE, p: SCRYPT_PARALLELISM },
      (err: Error | null, derived: Buffer) => {
        if (err) return reject(err);
        resolve(`${salt}:${derived.toString('hex')}`);
      },
    );
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  if (!salt || !key) return false;
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCKSIZE, p: SCRYPT_PARALLELISM },
      (err: Error | null, derived: Buffer) => {
        if (err) return reject(err);
        resolve(timingSafeEqual(Buffer.from(key, 'hex'), derived));
      },
    );
  });
}
