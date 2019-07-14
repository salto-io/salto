const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('./jest.base.config.js'),
  {
    name: 'salesforce-adapter-e2e',
    displayName: 'salesforce-adapter-e2e',
    testMatch: ['<rootDir>/e2e_test/**/*.test.(ts|js)'],
  }
)
