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

const { execSync } = require('child_process')
const { writeFileSync, existsSync, readdirSync } = require('fs')
const path = require('path')

const getChangedFiles = (userInputBaseCommit) => {
  const baseCommit = userInputBaseCommit ?? execSync('git merge-base main HEAD').toString().trim()
  console.log('base commit:', baseCommit)
  const output = execSync(`git diff --name-only ${baseCommit}..HEAD`).toString().split('\n')
  console.log('git diff output:', output)
  return output.filter(Boolean)
}

const getWorkspacesInfo = () => {
  const output = execSync('yarn --json workspaces info', { encoding: 'utf8' })
  return JSON.parse(JSON.parse(output).data)
}

const generateDependencyMapping = (workspaceInfo) => {
  const dependencyMapping = {}
  // Add the package as a dependency of itself
  Object.keys(workspaceInfo).forEach(packageName => dependencyMapping[packageName] = [packageName])
  const stack = []

  Object.keys(workspaceInfo).forEach(packageName => {
    stack.push(packageName)

    while (stack.length > 0) {
      const currentPackage = stack.pop()

      const packageWorkspaceInfo = workspaceInfo[currentPackage]
      if (!packageWorkspaceInfo || !packageWorkspaceInfo.workspaceDependencies) continue

      packageWorkspaceInfo.workspaceDependencies.forEach(dependency => {
        if (!dependencyMapping[dependency].includes(currentPackage)) {
          dependencyMapping[dependency].push(currentPackage)
          stack.push(dependency)
        }
      })
    }
  })

  return dependencyMapping
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
  
  const changedPackageLocation = new Set(changedFiles.map(path => path.split('/').slice(0, 2).join('/')))
  
  const changedPackages = Array.from(changedPackageLocation).map(packageDir => Object.keys(workspaceInfo).find(key => workspaceInfo[key].location === packageDir))
  const hasChangedFilesOutsidePackage = changedPackages.some(pkg => !pkg)

  console.log('Changed packages:', changedPackages)
  console.log('Has changes outside packages directory:', hasChangedFilesOutsidePackage)
  return { changedPackages, hasChangedFilesOutsidePackage }
}

const getDependenciesFromChangedPackages = (changedPackages, workspaceInfo) => {
  const dependencyMapping = generateDependencyMapping(workspaceInfo)
  console.log('Dependency mapping:', dependencyMapping)

  const changedPackagesDependencies = new Set(changedPackages.flatMap(package => dependencyMapping[package]).filter(Boolean))
  console.log('Changed packages dependencies:', changedPackagesDependencies)
  const dependenciesLocation = Array.from(changedPackagesDependencies).map(pkg => workspaceInfo[pkg].location).sort()
  console.log('Changed packages with dependencies location:', dependenciesLocation)

  const packagesToTest = dependenciesLocation.map(location => location.replace('packages/', ''))
  return packagesToTest
}

const getPackagesToTest = (userInputBaseCommit, workspaceInfo, allPackages) => {
  const { changedPackages, hasChangedFilesOutsidePackage } = findChangedPackages(userInputBaseCommit, workspaceInfo)
  return hasChangedFilesOutsidePackage ? allPackages : getDependenciesFromChangedPackages(changedPackages, workspaceInfo)
}

const main = () => {
  const args = process.argv.slice(2)
  const userInputBaseCommit = args.length > 0 ? args[0] : null
  if (userInputBaseCommit) {
    console.log(`User provided base commit: ${userInputBaseCommit}`)
  }

  const workspaceInfo = getWorkspacesInfo()
  const allPackages = Object.keys(workspaceInfo).map(pkg => workspaceInfo[pkg].location.replace('packages/', '')).sort()
  // on main branch, we want to test all packages
  const packagesToTest = process.env.CIRCLE_BRANCH === 'main' ? allPackages : getPackagesToTest(userInputBaseCommit, workspaceInfo, allPackages)
  console.log('Packages to test:', packagesToTest)

  const e2ePackagesToTest = packagesToTest.filter(hasE2eTests)
  const packagesWithE2eTestsFilePath = path.join(__dirname, '..', 'e2e_packages_to_test.txt')
  writeFileSync(packagesWithE2eTestsFilePath, e2ePackagesToTest.join('\n'))
}

main()
