#!/usr/bin/env node
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
const fs = require('fs')
const path = require('path')
const child_process = require('child_process')
const { promisify } = require('util')
const { parse } = require('jsonc-parser')
const exec = promisify(child_process.exec)

const mapValues = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v, i]) => [k, f(v, k, i)]))

const findKey = (o, pred) => {
  const foundEntry = Object.entries(o).find(([k, v], i) => pred(v, k, i)) || []
  return foundEntry[0]
}

const mapValuesAsync = async (o, f) => Object.fromEntries(
  await Promise.all(Object.entries(o).map(async ([k, v], i) => [k, await f(v, k, i)]))
)

const filterValues = (o, f) => Object.fromEntries(
  Object.entries(o).filter(([k, v], i) => f(v, k, i))
)

const readWorkspaces = async () => {
  const { stdout } = await exec('yarn workspaces -s info')
  return JSON.parse(stdout)
}

const readTsConfig = filename => {
  const jsonWithComments = fs.readFileSync(filename, { encoding: 'utf8' })
  return parse(jsonWithComments)
}


const tsConfigFilename = ({ location }) => path.join(location, 'tsconfig.json')

const readTsConfigs = workspaces => {
  const possibleTsConfigFilenames = mapValues(workspaces, tsConfigFilename)
  const tsConfigFilenames = filterValues(possibleTsConfigFilenames, fs.existsSync)
  return mapValues(tsConfigFilenames, readTsConfig)
}

const main = async () => {
  const workspaces = await readWorkspaces()
  const tsConfigs = readTsConfigs(workspaces)

  const referenceToWorkspacePackage = ({ path: refPath }, { location: packageLocation }) => {
    const pathSepRegEx = new RegExp(path.sep, 'g')
    const refLocation = path.join(packageLocation, refPath).replace(pathSepRegEx, '/')
    return findKey(workspaces, ({ location }) => location === refLocation)
  }

  const findMissingReferences = ({ location, workspaceDependencies }, { references = [] }) => {
    const tsConfigPackageRefs = references.map(ref => referenceToWorkspacePackage(ref, { location }))
    return workspaceDependencies.filter(r => !tsConfigPackageRefs.includes(r))
  }

  const findExtraneousReferences = ({ location, workspaceDependencies }, { references = [] }) => {
    const tsConfigPackageRefs = references.map(ref => referenceToWorkspacePackage(ref, { location }))
    return tsConfigPackageRefs.filter(r => !workspaceDependencies.includes(r))
  }

  const missingReferences = filterValues(
    mapValues(
      tsConfigs,
      (tsConfig, package) => findMissingReferences(workspaces[package], tsConfig)
    ),
    v => v.length,
  )

  const workspacePackageToReference = (
    package, refPackage,
  ) => ({
    path: path.relative(workspaces[package].location, workspaces[refPackage].location)
  })

  const extraneousReferences = filterValues(
    mapValues(
      tsConfigs,
      (tsConfig, package) => findExtraneousReferences(workspaces[package], tsConfig)
    ),
    v => v.length,
  )

  let success = true
  const verifyNoReferences = (references, adj, verb) => {
    if (Object.keys(references).length) {
      const referencesToList = mapValues(
        references,
        ((refs, package) => refs.map(r => workspacePackageToReference(package, r))),
      )

      const formattedReferencesToList = Object.entries(referencesToList)
        .map(([package, references]) => `${
          tsConfigFilename(workspaces[package])
        }, in "references":\n${
          references.map(r => `  { "path": "${r.path}" },`).join('\n')
        }\n`)
        .join('\n')

      console.error(`Found ${adj} references in package tsconfigs. Please ${verb} the following:\n\n${formattedReferencesToList}`)
      success = false
    }
  }
  verifyNoReferences(missingReferences, 'missing', 'add')
  verifyNoReferences(extraneousReferences, 'extraneous', 'remove')

  if (!success) {
    process.exit(1)
  }
}

main().catch(e => {
  console.error(e.stack || e)
  process.exit(2)
})
