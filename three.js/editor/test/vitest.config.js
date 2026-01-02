import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.js', '**/*.spec.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['../js/mrpp/**/*.js', '../js/utils/**/*.js'],
    },
    setupFiles: ['./setup.js'],
  },
  resolve: {
    alias: {
      'three': '../../../build/three.module.js',
    },
  },
});
