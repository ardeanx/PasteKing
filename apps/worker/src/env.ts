import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // S3 / MinIO
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('pasteking'),
  S3_SECRET_KEY: z.string().default('pasteking123'),
  S3_BUCKET: z.string().default('pasteking'),
  S3_REGION: z.string().default('us-east-1'),
});

export type WorkerEnv = z.infer<typeof envSchema>;

function validateEnv(): WorkerEnv {
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
    throw new Error(`Worker environment validation failed:\n${entries.join('\n')}`);
  }
  return result.data;
}

export const env = validateEnv();
