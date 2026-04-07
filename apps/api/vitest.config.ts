import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      API_PORT: '4000',
      API_URL: 'http://localhost:4000',
      DATABASE_URL: 'postgresql://pasteking:pasteking@localhost:5432/pasteking_test',
      REDIS_URL: 'redis://localhost:6379',
    },
  },
});
