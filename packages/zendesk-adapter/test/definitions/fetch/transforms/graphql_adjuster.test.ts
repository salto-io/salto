/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { transformGraphQLItem } from '../../../../src/definitions/fetch/transforms'

describe('graphql_adjuster', () => {
  it('should extract the data from the graphql response', async () => {
    const value = {
      data: {
        test: [{ a: 1 }, { b: 2 }],
      },
    }
    const finalValue = await transformGraphQLItem('test')({ value, context: {}, typeName: 'test' })
    expect(finalValue).toEqual([{ value: { a: 1 } }, { value: { b: 2 } }])
  })

  it('should throw an error if the value is not an object', async () => {
    await expect(transformGraphQLItem('test')({ value: 'test', context: {}, typeName: 'test' })).rejects.toThrow()
  })

  it('should return the value if the inner root does not exist', async () => {
    const value = {
      data: {
        test: [{ a: 1 }, { b: 2 }],
      },
    }
    const finalValue = await transformGraphQLItem('nonexistent')({ value, context: {}, typeName: 'notTest' })
    expect(finalValue).toEqual([{ value }])
  })

  it('should throw an error if the graphql response contains errors', async () => {
    const value = {
      errors: 'error',
    }
    await expect(transformGraphQLItem('test')({ value, context: {}, typeName: 'test' })).rejects.toThrow()
  })
})
