/* eslint-disable @typescript-eslint/no-var-requires */

const _ = require('lodash')
const defaults = require('./jest.common.config')

module.exports = _.merge(defaults, {
  collectCoverageFrom: [...defaults.collectCoverageFrom, '!<rootDir>/src/client/client.ts'],
  testMatch: ['<rootDir>/test/**/*.test.(ts|js)'],
})
