/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
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
