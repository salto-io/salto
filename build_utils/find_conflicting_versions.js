/*
*                      Copyright 2020 Salto Labs Ltd.
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
const fs = require('fs')
const path = require('path')
const _ = require('lodash')

const rootDir = path.join(__dirname, '..')
const packagesDir = path.join(rootDir, 'packages')
const manifestFilenames = [rootDir].concat(fs.readdirSync(packagesDir).map(d => path.join(packagesDir, d)))
  .map(d => path.join(d, 'package.json'))
  .filter(f => fs.statSync(f))

const manifests = Object.fromEntries(
  manifestFilenames.map(fn => [
    fn,
    JSON.parse(fs.readFileSync(fn))
  ])
)

const packageToDeps = _.mapValues(manifests, v => ({ ...v.dependencies, ...v.devDependencies }))

const depsVersions = Object.entries(packageToDeps).reduce((res, [manifest, deps]) => {
  Object.entries(deps).forEach(([name, version]) => {
    res[name] = res[name] || {}
    res[name][version] = res[name][version] || []
    res[name][version].push(manifest)
  })
  return res
}, {})

const mismatchedVersions = Object.fromEntries(
  Object.entries(depsVersions).filter(([_dep, versions]) => Object.keys(versions).length > 1)
)

console.dir(mismatchedVersions)
