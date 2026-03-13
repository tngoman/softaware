import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10_000,
    // Don't load .env — tests should be self-contained
    env: {},
  },
  resolve: {
    alias: {
      // Match the .js extension imports used in the source (ESM)
    },
  },
});
