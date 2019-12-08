const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    name: 'e2e-credentials-store',
    displayName: 'e2e-credentials-store',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!<rootDir>/dist/index.js',
    ],
    testEnvironment: 'jest-dynalite/dist/environment',
    coverageThreshold: {
      // Slowly start increasing here, never decrease!
      global: {
        branches: 98,
        functions: 98,
        lines: 98,
        statements: 98,
      },
    },
  }
)
