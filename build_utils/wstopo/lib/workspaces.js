import child_process from 'child_process'
import toposort from './toposort'

const yarnWorkspaces = () => JSON.parse(JSON.parse(
  child_process.execSync('yarn workspaces info --json', { encoding: 'utf8' })
).data)

const rightPad = (n, s) => [...s, ...Array(Math.max(0, n - s.length)).fill(' ')].join('')

const rightPadder = (possibleStrings, suffix) => {
  const maxLen = Math.max(...possibleStrings.map(s => s.length + suffix.length))
  return s => rightPad(maxLen, s + suffix)
}

export default () => {
  const workspaces = yarnWorkspaces()
  const deps = () => Object.fromEntries(
    Object.entries(workspaces).map(([id, d]) => [id, d.workspaceDependencies])
  )

  const padId = (suffix = '') => rightPadder(Object.keys(workspaces), suffix)

  const dir = id => workspaces[id].location

  const walk = handler => toposort(deps()).walk(handler)

  return {
    workspaces,
    deps,
    padId,
    dir,
    walk,
  }
}
