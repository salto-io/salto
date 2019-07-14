const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    globals: {
      'ts-jest': {
        diagnostics: {
          ignoreCodes: [7016, 7006],
        },
      },
    },
    name: 'salesforce-adapter',
    displayName: 'salesforce-adapter',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!<rootDir>/dist/src/client/client.js',
      '!<rootDir>/dist/src/tools/**', // At the moment we do not cover the tools
      '!<rootDir>/dist/index.js',
      !process.env['RUN_E2E_TESTS'] && '!dist/e2e_test/**/*',
    ].filter(p => p),
    testMatch: [
      process.env['RUN_E2E_TESTS'] && '<rootDir>/dist/e2e_test/**/*.test.js',
    ].filter(p => p),
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
