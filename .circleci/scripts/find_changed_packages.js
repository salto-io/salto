#! /usr/bin/env node

const { execSync } = require('child_process')
const { existsSync, readFileSync, writeFileSync, readdirSync } = require('fs')
const path = require('path')

function getChangedFiles() {
  const output = execSync('git log --name-status origin/main..HEAD').toString()
  return output
    .split('\n')
    .filter(line => line.startsWith('M') || line.startsWith('A') || line.startsWith('D'))
    .map(line => line.split('\t')[1])
    .filter(file => file && file.startsWith('packages/'))
}

// Fetch workspace info using `yarn workspaces info`
function fetchWorkspacesInfo() {
  const output = execSync('yarn workspaces info', { encoding: 'utf8' })
  const jsonOutput = output.substring(output.indexOf('{'), output.lastIndexOf('}') + 1)
  return JSON.parse(jsonOutput)
}

function resolveTransitiveDependencies(packageName, workspaceInfo, resolved, seen = new Set()) {
  if (seen.has(packageName)) {
    return
  }
  seen.add(packageName)

  const packageInfo = workspaceInfo[packageName]
  if (!packageInfo) {
    return
  }

  for (const dep of packageInfo.workspaceDependencies) {
    if (!resolved.has(dep)) {
      resolved.add(dep)
      resolveTransitiveDependencies(dep, workspaceInfo, resolved, seen)
    }
  }
}

function generateDependencyGraph(workspaceInfo) {
  const graph = {}

  for (const packageName of Object.keys(workspaceInfo)) {
    const resolvedDependencies = new Set()
    resolveTransitiveDependencies(packageName, workspaceInfo, resolvedDependencies)
    graph[packageName] = Array.from(resolvedDependencies)
  }

  return graph
}

// function hasE2eTests(packageName: string): boolean {
//   const e2eDir = path.join(__dirname, 'packages', packageName, 'e2e_test')
//   return existsSync(e2eDir) && readdirSync(e2eDir).some(file => file.endsWith('.test.ts'))
// }

// function hasUnitTests(packageName: string): boolean {
//   const e2eDir = path.join(__dirname, 'packages', packageName, 'test')
//   return existsSync(e2eDir) && readdirSync(e2eDir).some(file => file.endsWith('.test.ts'))
// }

function findChangedPackages() {
  const changedFiles = getChangedFiles()
  const changedPackages = new Set()

  for (const file of changedFiles) {
    const parts = file.split('/')
    if (parts.length > 1) {
      changedPackages.add(parts[1])
    }
  }

  return Array.from(changedPackages)
}

function main() {
  const changedPackages = findChangedPackages()
  console.log('Changed packages:', changedPackages)

  const dependencyGraph = generateDependencyGraph(fetchWorkspacesInfo())

  const packagesToTest = new Set()

  // if on main branch, run all tests
  if (process.env.CIRCLE_BRANCH === 'main') {
    console.log('Running all tests.')
    for (const pkg of dependencyGraph.keys()) {
      packagesToTest.add(pkg)
    }
  } else {
    // Otherwise, run tests for all changed packages and their dependencies
    for (const pkg of changedPackages) {
      packagesToTest.add(pkg)
      for (const dep of dependencyGraph[pkg]) {
        packagesToTest.add(dep)
      }
    }
  }

  // Add the list of packages to config.yml
  const configFilePath = path.join(__dirname, '..', '.circleci', 'config.yml')
  const configData = readFileSync(configFilePath, 'utf8')
  configData.replace('${PACKAGES_TO_TEST}', Array.from(packagesToTest).join('\n              - '))
  writeFileSync(configFilePath, configData)
  console.log(`Updated ${configFilePath} with packages to test.`)
}

main()
