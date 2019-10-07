const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js')(),
  {
    name: 'cli',
    displayName: 'cli',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!<rootDir>/index.ts',
      '!<rootDir>/src/callbacks.ts',
    ],
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
