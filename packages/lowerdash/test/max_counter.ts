/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export type MaxCounter = {
  increment(): void
  decrement(): void
  max: number
}

export const maxCounter = (): MaxCounter => {
  let current = 0
  let max = current
  return {
    increment() {
      current += 1
      if (current > max) {
        max = current
      }
    },
    decrement() {
      current -= 1
    },
    get max() {
      return max
    },
  }
}
