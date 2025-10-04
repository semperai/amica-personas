import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.spec.[jt]s?(x)'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        'vitest.config.ts',
        'vitest.setup.ts',
        '*.config.js',
        '*.config.ts',
        '.prettierrc.js',
        'github-actions-reporter.js',
        'postcss.config.js',
        'tailwind.config.js',
        'vite-plugins/**',
        'public/**',
        'scripts/**',
        '__mocks__/**',
        'containers/**',
        'examples/**',
        'integration-tests/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
