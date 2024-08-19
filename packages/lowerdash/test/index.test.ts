/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import * as lowerdash from '../src'

describe('index.ts', () => {
  it('should define the namespaces', () => {
    expect(lowerdash.collections).toBeDefined()
    expect(lowerdash.promises).toBeDefined()

    // test import of type SetId
    const t: lowerdash.collections.set.SetId = 1
    expect(t).toBe(1)
  })
})
