const test_dir = process.env['RUN_E2E_TESTS'] ? 'e2e_test' : 'test'

module.exports = (workspaceRoot = '<rootDir>/../..') => ({
  verbose: true,
  testEnvironment: 'node',
  testMatch: [
    `<rootDir>/${test_dir}/**/*.test.ts`,
  ],
  transform: {
    '\\.[jt]s$': `${workspaceRoot}/build_utils/jest_ts_transformer.js`,
  },
  testRunner: "jest-circus/runner",
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    '**/*.ts',
    '**/*.tsx',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!*.config.js',
    '!coverage/**',
    '!e2e_test/**'
  ],
})
