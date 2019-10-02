const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    name: 'salto-vscode',
    displayName: 'salto-vscode',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      // This file is only used as a bridge with vsc. The overhead of mocking vsc has bad ROI.
      '!**/extension.*',
      '!**/adapters.*', 
      '!**/providers.*',
      '!**/events.*',  
      '!**/salto/debug.*'
    ],
    coverageThreshold: {
      // Slowly start increasing here, never decrease!
      global: {
        branches: 85,
        functions: 90,
        lines: 85,
        statements: 90,
      },
    },
  }
)
