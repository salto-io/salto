const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    name: 'salesforce-adapter',
    displayName: 'salesforce-adapter',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!<rootDir>/dist/src/client/client.js',
      '!<rootDir>/dist/src/tools/**', // At the moment we do not cover the tools
      '!<rootDir>/dist/index.js',
    ],
    testEnvironment: process.env.RUN_E2E_TESTS ? './dist/e2e_test/jest_environment' : undefined,
    coverageThreshold: {
      './src/client/types.ts': {
        branches: 49,
        functions: 59,
        lines: 78,
        statements: 75,
      },
    },
  },
)
