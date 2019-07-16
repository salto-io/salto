const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('./jest.base.config.js'),
  {
    globals: {
      'ts-jest': {},
    },
    name: 'salesforce-adapter',
    displayName: 'salesforce-adapter',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!<rootDir>/src/client/client.ts',
    ],
    testMatch: ['<rootDir>/test/**/*.test.(ts|js)'],
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
