/* eslint-disable no-bitwise */

export const MAX_HASH = 2 ** 31
export const MIN_HASH = -MAX_HASH

// taken from: https://stackoverflow.com/a/8831937
export default (s: string): number => {
  let hash = 0

  for (let i = 0; i < s.length; i += 1) {
    const char = s.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash &= hash // Convert to 32bit integer
  }

  return hash
}
