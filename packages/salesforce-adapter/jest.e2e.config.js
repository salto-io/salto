/* eslint-disable @typescript-eslint/no-var-requires */

const _ = require('lodash')
const defaults = require('./jest.common.config')

module.exports = _.merge(defaults, {
  testMatch: ['<rootDir>/e2e_test/**/*.test.(ts|js)'],
})
