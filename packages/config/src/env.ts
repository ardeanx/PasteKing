import { config } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';
import type { ZodSchema } from 'zod';

export function loadEnv<T>(schema: ZodSchema<T>, envPath?: string): T {
  config({ path: envPath ?? resolve(process.cwd(), '.env') });
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const tree = z.treeifyError(result.error) as {
      errors: string[];
      properties?: Record<string, { errors: string[] } | undefined>;
    };
    const entries: string[] = [];
    if (tree.properties) {
      for (const [key, sub] of Object.entries(tree.properties)) {
        if (sub && sub.errors.length > 0) {
          entries.push(`  ${key}: ${sub.errors.map((e: string) => e).join(', ')}`);
        }
      }
    }
    throw new Error(`Environment validation failed:\n${entries.join('\n')}`);
  }
  return result.data;
}
