/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { set, map, array, iterable, asynciterable, treeMap } from '../../src/collections'

describe('index.ts', () => {
  it('should export all modules', () => {
    expect(set).toBeDefined()
    expect(map).toBeDefined()
    expect(array).toBeDefined()
    expect(iterable).toBeDefined()
    expect(asynciterable).toBeDefined()
    expect(treeMap).toBeDefined()
  })
})
