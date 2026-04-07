import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  API_URL: z.string().url().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // Auth
  SESSION_SECRET: z.string().min(32).default('change-me-in-production-must-be-32-chars-long!!'),
  SESSION_MAX_AGE_HOURS: z.coerce.number().positive().default(72),

  // S3 / MinIO
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('pasteking'),
  S3_SECRET_KEY: z.string().default('pasteking123'),
  S3_BUCKET: z.string().default('pasteking'),
  S3_REGION: z.string().default('us-east-1'),

  // Storage threshold (bytes) — content above this goes to object storage
  STORAGE_THRESHOLD: z.coerce.number().positive().default(65536),

  // OAuth providers (optional — OAuth disabled if not set)
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),

  // Stripe (optional — billing disabled if not set)
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PRO_PRICE_ID: z.string().default(''),
  STRIPE_TEAM_PRICE_ID: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const tree = z.treeifyError(result.error) as {
      errors: string[];
      properties?: Record<string, { errors: string[] } | undefined>;
    };
    const entries: string[] = [];
    if (tree.properties) {
      for (const [key, sub] of Object.entries(tree.properties)) {
        if (sub && sub.errors.length > 0) {
          entries.push(`  ${key}: ${sub.errors.join(', ')}`);
        }
      }
    }
    throw new Error(`API environment validation failed:\n${entries.join('\n')}`);
  }
  return result.data;
}

export const env = validateEnv();
