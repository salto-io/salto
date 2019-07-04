module.exports = {
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.json',
    },
  },
  moduleFileExtensions: ['js', 'ts'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.[jt]s',
    '**/*.[jt]sx',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!<rootDir>/*.config.js',
    '!<rootDir>/src/tools/**', // At the moment we do not cover the tools
    '!<rootDir>/src/client/client.ts', // Ignore abstraction layer above jsforce
    '!<rootDir>/(test|dist|coverage)/**',
  ],
  coverageThreshold: {
    // Slowly start increasing here, never decrease!
    global: {
      branches: 70,
      functions: 90,
      lines: 85,
      statements: 90,
    },
  },
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  testMatch: ['<rootDir>/test/**/*.test.(ts|js)'],
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  testEnvironment: 'node',
  preset: 'ts-jest',
}
