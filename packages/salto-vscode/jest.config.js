const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    name: 'salto-vscode',
    displayName: 'salto-vscode',
    rootDir: `${__dirname}`,
    moduleFileExtensions: ['js', 'json', 'node'],
    coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/[^/]+\.js']
    // coverageThreshold: {
    //   // Slowly start increasing here, never decrease!
    //   global: {
    //     branches: 90,
    //     functions: 90,
    //     lines: 85,
    //     statements: 90,
    //   },
    // },
  }
)
