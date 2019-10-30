export const deleteFromArray = (ar, v) => {
  const i = ar.indexOf(v)
  if (i === -1) {
    return false
  }
  ar.splice(i, 1)
  return true
}

export const uniq = ar => [...new Set(ar).values()]
