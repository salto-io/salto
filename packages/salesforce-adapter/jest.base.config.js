const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    collectCoverageFrom: [
      '!<rootDir>/src/tools/**', // At the moment we do not cover the tools
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
  }
)
