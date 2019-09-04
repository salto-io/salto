const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    name: 'salto',
    displayName: 'salto',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!**/wasm_exec.*', // External source file
    ],
    moduleNameMapper: {
      '^@salto/utils/(.*)': '<rootDir>/../../node_modules/@salto/utils/dist/src/$1',
    },
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
