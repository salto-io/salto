const deepMerge = require('../../build_utils/deep_merge')

module.exports = Object.assign(
  {},
  deepMerge(
    require('./jest.base.config.js'),
    {
      name: 'salesforce-adapter-e2e',
      displayName: 'salesforce-adapter-e2e',
    },
  ),
  { testMatch: ['<rootDir>/dist/e2e_test/**/*.test.js'] },
)
