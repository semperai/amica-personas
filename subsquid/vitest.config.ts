import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'node_modules/**',
        'lib/**',
        'db/**',
        'scripts/**',
        '**/*.config.*',
        '**/abi/**',
        'src/abi/**',
        'src/model/**',
      ],
    },
  },
});
