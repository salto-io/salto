const asyncToArray = <T>(i: AsyncIterable<T>): Promise<ReadonlyArray<T>> => {
  const result: T[] = []
  const iter = i[Symbol.asyncIterator]()
  const next = async (): Promise<T[]> => {
    const { done, value } = await iter.next()
    if (done) {
      return result
    }
    result.push(value)
    return next()
  }
  return next()
}

export default asyncToArray
