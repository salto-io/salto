import { deleteFromArray, uniq } from './array_utils'

export default (source) => {
  const shallowClone = source => Object.fromEntries(
    Object.entries(source).map(([k, v]) => [k, [...v]])
  )

  const deps = shallowClone(source)

  const findFreeKeys = (keys) => keys.filter(k => deps[k].length === 0)

  const deleteKey = key => {
    delete deps[key]
    return Object.entries(deps)
      .filter(([_k, v]) => deleteFromArray(v, key))
      .map(([k]) => k)
  }

  const ensureEmpty = () => {
    if (Object.keys(deps).length !== 0) {
      throw new Error(`Dependency cycle: ${JSON.stringify(deps)}`)
    }
  }

  const walk = async handler => {
    const next = affectedIds => Promise.all(
      findFreeKeys(affectedIds)
        .map(async id => {
          await handler(id)
          return next(deleteKey(id))
        })
    )

    await next(Object.keys(deps))
    return ensureEmpty()
  }

  return { walk }
}


// const toposort = deps => {
//   deps = shallowCloneDeps(deps)

//   const result = []


//   const findFreeKeys = (keys) => keys.filter(k => deps[k].length === 0)

//   let nextKeys = Object.keys(deps)

//   const deleteKey = key => {
//     delete deps[key]
//     return Object.entries(deps)
//       .filter(([_k, v]) => deleteFromArray(v, key))
//       .map(([k]) => k)
//   }

//   while (true) {
//     freeKeys = findFreeKeys(nextKeys)
//     const done = freeKeys.length === 0

//     if (done) {
//       if (Object.keys(deps).length !== 0) {
//         throw new Error(`Dependency cycle: ${JSON.stringify(deps)}`)
//       }
//       break
//     }

//     nextKeys = freeKeys.map(k => deleteKey(k)).flat(1)
//     result.push(...freeKeys)
//   }

//   return result
// }

// module.exports = toposort
