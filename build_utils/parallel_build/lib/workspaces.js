import fs from 'fs'
import path from 'path'
import child_process from 'child_process'
import toposort from './toposort'

const yarnWorkspaces = () => JSON.parse(
  child_process.execSync('yarn workspaces info -s', { encoding: 'utf8' })
)

const padRight = (n, s) => [...s, ...Array(Math.max(0, n - s.length)).fill(' ')].join('')

module.exports = () => {
  const workspaces = yarnWorkspaces()
  const deps = () => Object.fromEntries(
    Object.entries(workspaces).map(([id, d]) => [id, d.workspaceDependencies])
  )

  const padWorkspaceId = () => {
    const maxWorkspaceIdLen = Math.max(...Object.keys(workspaces).map(s => s.length))
    return padRight.bind(null, maxWorkspaceIdLen)
  }

  const dir = id => workspaces[id].location

  const parallel = (cmd = ['yarn']) => {
    padId = padWorkspaceId()

    const consoleOutputData = (id, child) => {
      paddedId = padId(id)
      Object.entries({ stdout: 'log', stderr: 'error'}).forEach(
        (stream, logFunc) => child[stream].on('data', data => {
          console[logFunc]([paddedId, data].join(': '))
        })
      )
    }

    return toposort(deps()).walk(async id => new Promise((resolve, reject) => {
      console.log(`starting child process for ${id}`)
      const child = child_process.spawn(cmd[0], cmd.slice(1), { cwd: dir(id) })
      consoleOutputData(id, child)
      child.on('close', code => code === 0
        ? resolve()
        : reject(`cmd ${cmd.join(' ')} for ${id} ended with code ${code}`)
      )
    }))
  }

  const printToposort = () => console.log(toposort(deps()).toposort().map(dir).join('\n'))

  return { parallel, toposort }
}

const workspaces = rootDir => {
  const rootPath = (...p) => path.join(rootDir, ...p)
  const packageJsonPath = rootPath(PACKAGE_JSON)
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf8' }))
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
