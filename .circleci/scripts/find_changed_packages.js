/*
 *                      Copyright 2024 Salto Labs Ltd.
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

const { execSync, exec } = require('child_process')
const { readFileSync, writeFileSync, existsSync, readdirSync } = require('fs')
const path = require('path')

const getChangedFiles = (userInputBaseCommit) => {
  const commitHashRegex = /\b[0-9a-f]{9}/g
  // If we didn't get a defined commit hash, take one commit back from the first commit in this PR
  const baseCommit = userInputBaseCommit ?? `${execSync('curl -s -H "Authorization: token ${GITHUB_AUTH_TOKEN}" https://api.github.com/repos/salto-io/salto/pulls/5931/commits | jq -r ".[0] | .sha" | tr -d "\n"')}^`
  console.log('base commit:', baseCommit)
  const output = execSync(`git log --oneline --name-only ${baseCommit}..HEAD`).toString().split('\n').filter(line => !commitHashRegex.test(line))
  console.log('git log output:', output)
  return output.filter(file => file && file.startsWith('packages/'))
}

const getWorkspacesInfo = () => {
  const output = execSync('yarn --json workspaces info', { encoding: 'utf8' })
  return JSON.parse(JSON.parse(output).data)
}

const resolveTransitiveDependencies = (packageName, workspaceInfo) => {
  const packageInfo = workspaceInfo[packageName]
  if (!packageInfo) {
    return
  }

  return packageInfo['workspaceDependencies'].map(dep => resolveTransitiveDependencies(dep, workspaceInfo))
}


const generateDependencyMapping = (workspaceInfo) => {
  return Object.entries(workspaceInfo)
  .map(([packageName, info]) => 
    info.workspaceDependencies.map(dep => [dep, packageName])
  )
  .flat()
  .reduce((acc, [dep, packageName]) => {
    if (!acc[dep]) {
      acc[dep] = []
    }
    acc[dep].push(packageName)
    return acc
  }, {})
}

const hasE2eTests = (packageName) => {
  const e2eDir = path.join(__dirname, '..', '..', 'packages', packageName, 'e2e_test')
  const e2eDirExists = existsSync(e2eDir)
  const e2eDirHasTestFiles = e2eDirExists && readdirSync(e2eDir).some(file => file.endsWith('.test.ts'))
  console.log('e2eDir:', e2eDir, 'exists:', e2eDirExists, 'hasTestFiles:', e2eDirHasTestFiles)
  return e2eDirHasTestFiles
}

const findChangedPackages = (userInputBaseCommit, workspaceInfo) => {
  const changedFiles = getChangedFiles(userInputBaseCommit)
  console.log('Changed files:', changedFiles)
  const changedPackageLocation = changedFiles.map(path => path.split('/').slice(0, 2).join('/')).filter((value, index, self) => self.indexOf(value) === index)

  const changedPackages = changedPackageLocation.map(packageDir =>Object.keys(workspaceInfo).find(key => workspaceInfo[key].location === packageDir))
  return changedPackages
}

const getPackagesToTest = (userInputBaseCommit, workspaceInfo) => {
  const changedPackages = findChangedPackages(userInputBaseCommit, workspaceInfo)
  console.log('Changed packages:', changedPackages)

  const dependencyMapping = generateDependencyMapping(workspaceInfo)
  console.log('Dependency mapping:', dependencyMapping)

  const changedPackagesDependencies = changedPackages.flatMap(package => dependencyMapping[package]).filter((value, index, self) => self.indexOf(value) === index)
  console.log('Changed packages dependencies:', changedPackagesDependencies)
  const dependenciesLocation = changedPackagesDependencies.map(pkg => workspaceInfo[pkg].location).concat(changedPackages.map(pkg => workspaceInfo[pkg].location)).sort()
  console.log('Changed packages with dependencies:', dependenciesLocation)

  packagesToTest = dependenciesLocation.map(location => location.replace('packages/', ''))
  console.log('Packages to test:', packagesToTest)
  return packagesToTest
}

const main = () => {
  const args = process.argv.slice(2)
  console.log(`User provided arguments: ${args}`)

  const userInputBaseCommit = args.length > 0 ? args[0] : null
  console.log(`attempting to use ${userInputBaseCommit} as base commit`)

  const workspaceInfo = getWorkspacesInfo()
  const allPackages = Object.keys(workspaceInfo).map(pkg => workspaceInfo[pkg].location.replace('packages/', '')).sort()
  // on main branch, we want to test all packages
  const packagesToTest = process.env.CIRCLE_BRANCH === 'main' ? allPackages : getPackagesToTest(userInputBaseCommit, workspaceInfo)

  const e2ePackagesToTest = packagesToTest.filter(hasE2eTests)
  const packagesWithE2eTestsFilePath = path.join(__dirname, '..', 'e2e_packages_to_test.txt')
  writeFileSync(packagesWithE2eTestsFilePath, e2ePackagesToTest.join('\n'))
}

main()
