const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    name: 'salto',
    displayName: 'salto',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!**/wasm_exec.*', // External source file
      !process.env['RUN_E2E_TESTS'] && '!dist/e2e_test/**/*',
    ].filter(p => p),
    testMatch: [
      process.env['RUN_E2E_TESTS'] && '<rootDir>/dist/e2e_test/**/*.test.js',
    ].filter(p => p),
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
