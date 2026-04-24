import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.js', '**/*.spec.js', '**/*.test.ts', '**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['../js/mrpp/**/*.js', '../js/utils/**/*.js', 'plugin/**/*.ts'],
    },
    setupFiles: ['./setup.js'],
  },
  resolve: {
    alias: {
      'three': resolve(__dirname, '../../../build/three.module.js'),
    },
  },
});
