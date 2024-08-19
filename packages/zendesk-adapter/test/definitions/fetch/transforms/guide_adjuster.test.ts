/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { transformGuideItem } from '../../../../src/definitions/fetch/transforms'

describe('guide_adjuster', () => {
  const value = {
    a: 1,
  }
  it('should add brand correctly with brandId', async () => {
    const context = {
      brandId: 123,
    }
    const finalValue = await transformGuideItem({ value, context, typeName: 'test' })
    expect(finalValue).toEqual({
      value: {
        a: 1,
        brand: 123,
      },
    })
  })
  it('should add brand correctly with parent brand id', async () => {
    const context = {
      parent: {
        brand: 123,
      },
    }
    const finalValue = await transformGuideItem({ value, context, typeName: 'test' })
    expect(finalValue).toEqual({
      value: {
        a: 1,
        brand: 123,
      },
    })
  })
  it('should do nothing if brand is not defined', async () => {
    const context = {}
    const finalValue = await transformGuideItem({ value, context, typeName: 'test' })
    expect(finalValue).toEqual({
      value: {
        a: 1,
      },
    })
  })
})
