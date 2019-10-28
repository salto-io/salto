import * as fs from 'fs'
import * as path from 'path'

const packageJsonStr = fs.readFileSync(
  path.join(__dirname, '..', '..', 'package.json'),
  { encoding: 'utf8' },
)

const { version, git } = JSON.parse(packageJsonStr)
const { branch, commit } = git

export const versionObj = { version, branch, commit }

export const versionString = Object.entries(versionObj)
  .filter(([_k, v]) => v)
  .map(kv => kv.join(' '))
  .join(', ')
