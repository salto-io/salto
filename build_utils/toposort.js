const toposort = deps => {
  deps = Object.fromEntries(
    Object.entries(deps).map(([k, v]) => [k, [...v]])
  ) // shallow clone

  const result = []

  const deleteFromArray = (ar, v) => {
    const i = ar.indexOf(v)
    if (i === -1) {
      return false
    }
    ar.splice(i, 1)
    return true
  }

  const findFreeKeys = (keys) => keys.filter(k => deps[k].length === 0)

  let nextKeys = Object.keys(deps)

  const deleteKey = key => {
    delete deps[key]
    return Object.entries(deps)
      .filter(([_k, v]) => deleteFromArray(v, key))
      .map(([k]) => k)
  }

  while (true) {
    freeKeys = findFreeKeys(nextKeys)
    const done = freeKeys.length === 0

    if (done) {
      if (Object.keys(deps).length !== 0) {
        throw new Error(`Dependency cycle: ${JSON.stringify(deps)}`)
      }
      break
    }

    nextKeys = freeKeys.map(k => deleteKey(k)).flat(1)
    result.push(...freeKeys)
  }

  return result
}

module.exports = toposort
