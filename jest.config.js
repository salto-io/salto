/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/* eslint-disable @typescript-eslint/no-var-requires */
const _ = require('lodash')
const fs = require('fs')
const path = require('path')

const packagesDir = `${__dirname}/packages`
const packagesWithoutTests = ['vscode', 'zendesk-support-adapter']
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

