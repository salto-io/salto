#!/usr/bin/env node
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
const child_process = require('child_process')
const { promisify } = require('util')

const exec = promisify(child_process.exec)

const mapValues = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v, i]) => [k, f(v, k, i)]))

const mapValuesAsync = async (o, f) => Object.fromEntries(
  await Promise.all(Object.entries(o).map(async ([k, v], i) => [k, await f(v, k, i)]))
)

const filterValues = (o, f) => Object.fromEntries(
  Object.entries(o).filter(([k, v], i) => f(v, k, i))
)

const readManifests = async () => {
  const { stdout } = await exec('yarn workspaces -s info')
  return mapValuesAsync(JSON.parse(stdout), async info => {
    const manifestFile = path.join(info.location, 'package.json')
    return JSON.parse(await fs.promises.readFile(manifestFile))
  })
}

const main = async () => {
  const manifests = await readManifests()

  const packageToDeps = mapValues(manifests, v => ({ ...v.dependencies, ...v.devDependencies }))

  const depsVersions = Object.entries(packageToDeps).reduce(
    (res, [manifest, deps]) => Object.entries(deps).reduce((res, [name, version]) => {
      res[name] = res[name] || {}
      res[name][version] = res[name][version] || []
      res[name][version].push(manifest)
      return res
    }, res),
    {},
  )

  const mismatchedVersions = filterValues(
    depsVersions,
    versions => Object.keys(versions).length > 1
  )

  const numberOfMismatches = Object.keys(mismatchedVersions).length
  if (numberOfMismatches === 0) {
    return
  }

  console.error('Found conflicting versions:\n%s', JSON.stringify(mismatchedVersions, null, 4))
  process.exit(2)
}

main().catch(e => {
  console.error(e.stack || e)
  process.exit(2)
})
