import versionObj from './generated/version.json'

export const version = versionObj
export const versionString = Object.entries(versionObj)
  .filter(([_k, v]) => v)
  .map(kv => kv.join(' '))
  .join(', ')
