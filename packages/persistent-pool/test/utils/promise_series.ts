/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
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
