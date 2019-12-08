module.exports = {
  verbose: true,
  testEnvironment: 'node',
  name: 'persistent-pool',
  displayName: 'persistent-pool',
  rootDir: `${__dirname}`,
  testMatch: ['<rootDir>/dist/test/**/*.test.js'],
  testRunner: "jest-circus/runner",
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    'dist/**/*.js',
    'dist/**/*.jsx',
    '!**/node_modules/**',
    '!*.config.js',
    '!coverage/**',
    '!dist/test/**',
    '!<rootDir>/dist/src/index.js',
  ],
  testEnvironment: './dist/test/lib/dynamodb/environment',
  coverageThreshold: {
    global: {
      branches: 98,
      functions: 98,
      lines: 98,
      statements: 98,
    },
  },
}
