module.exports = {
  verbose: true,
  testEnvironment: 'node',
  testMatch: [
    process.env['RUN_E2E_TESTS']
      ? '<rootDir>/dist/e2e_test/**/*.test.js'
      : '<rootDir>/dist/test/**/*.test.js'
  ],
  moduleNameMapper: {
    '^@salto/utils/(.*)': '<rootDir>/../../node_modules/@salto/utils/dist/src/$1',
  },
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    '**/*.js',
    '**/*.jsx',
    '!**/node_modules/**',
    '!*.config.js',
    '!coverage/**',
    '!dist/test/**',
    '!dist/e2e_test/**',
  ],
}
