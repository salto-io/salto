const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    name: 'dag',
    displayName: 'dag',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!<rootDir>/dist/index.js',
    ],
    coverageThreshold: {
      // Slowly start increasing here, never decrease!
      global: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  }
)
