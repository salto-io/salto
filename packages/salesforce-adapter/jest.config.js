const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js')(),
  {
    name: 'salesforce-adapter',
    displayName: 'salesforce-adapter',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!<rootDir>/src/client/client.ts',
      '!<rootDir>/src/tools/**', // At the moment we do not cover the tools
      '!<rootDir>/index.ts',
    ],
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
