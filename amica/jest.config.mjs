/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.spec.[jt]s?(x)'],
  moduleNameMapper: {
    '^@/utils/config$': '<rootDir>/__mocks__/@/utils/config.ts',
    '^@/utils/buildUrl$': '<rootDir>/__mocks__/@/utils/buildUrl.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
          },
        },
        target: 'es2022',
      },
      module: {
        type: 'commonjs',
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(viem|@rainbow-me|wagmi)/)',
  ],
}

export default config
