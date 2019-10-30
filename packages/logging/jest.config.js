const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    name: '@salto/logging',
    displayName: '@salto/logging',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!<rootDir>/dist/index.js',
    ],
    coverageThreshold: {
      global: {
        branches: 98,
        functions: 98,
        lines: 98,
        statements: 98,
      },
    },
  }
)
