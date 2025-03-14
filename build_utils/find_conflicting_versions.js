#!/usr/bin/env node
/*
* Copyright 2025 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  const { stdout } = await exec('yarn workspaces list --json -v')
  const entries = await Promise.all(
    JSON.parse(`[${stdout.split('\n').filter(Boolean).join(',')}]`)
      .map(async ({ name, location }) => {
        const manifestFile = path.join(location, 'package.json')
        return [name, JSON.parse(await fs.promises.readFile(manifestFile))]
      }),
  )
  return Object.fromEntries(entries)
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

  if (mismatchedVersions) {
    console.log(mismatchedVersions)
  }

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
