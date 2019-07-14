const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    name: 'salto',
    displayName: 'salto',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!<rootDir>/src/parser/wasm_exec.js', // External source file
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
