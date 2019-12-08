const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    name: 'cli',
    displayName: 'cli',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!<rootDir>/dist/index.js',
      '!<rootDir>/dist/src/callbacks.js',
    ],
    testEnvironment: process.env.RUN_E2E_TESTS
      ? 'salesforce-adapter/dist/e2e_test/jest_environment'
      : undefined,
    coverageThreshold: {
      // Slowly start increasing here, never decrease!
      global: {
        branches: 90,
        functions: 90,
        lines: 85,
        statements: 90,
      },
    },
  }
)
