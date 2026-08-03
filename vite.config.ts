import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'es2020',
    // Safari iOS necesita que nada dependa de features recientes; el bundle es un solo chunk.
    cssCodeSplit: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
