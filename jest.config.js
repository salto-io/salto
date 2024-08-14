/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const _ = require('lodash')
const fs = require('fs')
const path = require('path')

const packagesDir = `${__dirname}/packages`
const packagesWithoutTests = ['vscode']
const packageConfigs = (() => {
  const packageDir = package => './' + path.relative(__dirname, `${packagesDir}/${package}`)
  const packages = fs.readdirSync(packagesDir).filter(p => !packagesWithoutTests.includes(p))

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

const coverageThreshold = Object.assign({},
  ..._(packageConfigs)
    .map((config, dir) => ({
      [`${path.join(packagesDir, dir)}/`]: (config.coverageThreshold || {}).global || {}
    })),
)

module.exports = Object.assign(
  {},
  require('./jest.base.config.js'),
  {
    projects: ['packages/*'],
    coverageDirectory: '<rootDir>/coverage/',
    collectCoverageFrom,
    cacheDirectory: '.jest_cache',
    coverageThreshold,
  }
)

