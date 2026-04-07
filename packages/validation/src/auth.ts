import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, hyphens, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export type RegisterSchema = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginSchema = z.infer<typeof loginSchema>;

export const createApiTokenSchema = z.object({
  name: z.string().min(1, 'Token name is required').max(100, 'Token name must be at most 100 characters'),
  scopes: z
    .array(z.enum(['paste:create', 'paste:read:own', 'paste:delete:own']))
    .default([]),
});

export type CreateApiTokenSchema = z.infer<typeof createApiTokenSchema>;
