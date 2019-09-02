const makeArray = <TIn>(input: TIn | TIn[] | undefined): TIn[] => {
  if (input === undefined) {
    return []
  }
  return Array.isArray(input) ? input : [input]
}

export default makeArray
