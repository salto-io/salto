/* eslint-disable @typescript-eslint/no-var-requires */
const _ = require('lodash')
const fs = require('fs')
const path = require('path')

const packageConfigs = (() => {
  const packagesDir = `${__dirname}/packages`
  const packageDir = package => './' + path.relative(__dirname, `${packagesDir}/${package}`)
  const packages = fs.readdirSync(packagesDir)

  return Object.assign.apply(
    {},
    packages.map(package => ({
      [package]: require(`${packageDir(package)}/jest.config.js`),
    }))
  )
})()

const collectCoverageFrom = _(packageConfigs)
  .map(config => config.collectCoverageFrom || [])
  .flatten().sort().uniq()
  .orderBy(p => p.startsWith('!')) // "include" patterns first, then "exclude"
  .value()

module.exports = Object.assign(
  {},
  require('./jest.base.config.js')('<rootDir>'),
  {
    projects: ['packages/*'],
    coverageDirectory: '<rootDir>/coverage/',
    collectCoverageFrom,
    cacheDirectory: '.jest_cache',
  }
)
