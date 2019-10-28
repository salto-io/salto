const fs = require('fs')
const path = require('path')
const glob = require('glob')
const gitRevSync = require('git-rev-sync')
const toposort = require('./toposort')

const PACKAGE_JSON = 'package.json'
const JSON_INDENT = 2

const uniq = ar => [...new Set(ar).values()]

const workspaces = rootDir => {
  const rootPath = (...p) => path.join(rootDir, ...p)
  const packageJsonPath = rootPath(PACKAGE_JSON)
  const packageJson = require(packageJsonPath)
  const workspacePaths = uniq(
    packageJson.workspaces.packages.map(g => glob.sync(rootPath(g))).flat(1)
  )

  const workspacePackageJsons = Object.fromEntries(
    workspacePaths
      .map(p => path.join(p, PACKAGE_JSON))
      .map(p => [p, require(p)])
  )

  const writePackageJson = (p, j) => fs.writeFileSync(
    p,
    JSON.stringify(j, null, JSON_INDENT),
  )

  const mutatePackageJsons = mutator => Object.entries(workspacePackageJsons)
    .forEach(([p, j]) => writePackageJson(p, mutator(j)))

  return {
    ensureVersionInPackages(version) {
      version = version || packageJson.version
      if (!version) {
        throw Error(`Could not find version in ${packageJsonPath}`)
      }

      if (version !== packageJson.version) {
        writePackageJson(packageJsonPath, Object.assign(packageJson, { version }))
      }

      mutatePackageJsons(j => Object.assign(j, { version }))
    },
    gitInfo() {
      return {
        commit: gitRevSync.short(rootDir),
        branch: gitRevSync.branch(rootDir),
      }
    },
    ensureGitInfoInPackages() {
      mutatePackageJsons(j => Object.assign(j, { git: this.gitInfo() }))
    },
    writeTopoOrder() {
      writePackageJson(
        packageJsonPath,
        Object.assign(packageJson, { topoOrder: this.topoOrder().join(' ') }),
      )
    },
    topoOrder() {
      const PACKAGE_JSON_DEP_KEYS = [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
        'peerDependencies',
      ]

      const extractDependenciesNames = j => uniq(
        PACKAGE_JSON_DEP_KEYS.map(k => Object.keys(j[k] || {})).flat(1)
      )

      const workspaceNames = Object.values(workspacePackageJsons).map(j => j.name)

      const workspaceDeps = Object.fromEntries(
        Object.values(workspacePackageJsons)
          .map(j => [
            j.name,
            extractDependenciesNames(j).filter(d => workspaceNames.includes(d)),
          ])
      )

      return toposort(workspaceDeps)
    },
  }
}

module.exports = workspaces
