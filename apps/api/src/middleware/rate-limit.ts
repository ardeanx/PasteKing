import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

const skip = () => process.env.NODE_ENV === 'test';

const rateLimitMessage = {
  success: false,
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later',
  },
};

/**
 * Key generator that uses userId when authenticated, falls back to IP.
 * Authenticated users get a per-user bucket.
 */
function userOrIpKey(req: Request): string {
  if (req.user?.id) return `user:${req.user.id}`;
  return req.ip ?? 'unknown';
}

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req: Request) => (req.user ? 200 : 100), // authenticated users get 2x
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: rateLimitMessage,
});

export const createPasteRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req: Request) => (req.user ? 40 : 20), // authenticated users get 2x
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many paste creations, please try again later',
    },
  },
});

export const reportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 reports per 15 minutes
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many reports, please try again later',
    },
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 auth attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
    },
  },
});
