const promiseSeries = <T>(f: () => Promise<T>, count: number): Promise<void> => {
  const next = async (i = 0): Promise<void> => {
    if (i < count) {
      await f()
      await next(i + 1)
    }
  }
  return next()
}

export default promiseSeries
