/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { inspectValue } from '@salto-io/adapter-utils'
import { transformRequest, transformResponse } from '../../../../src/definitions/deploy/transforms/graphql_adjuster'

describe('graphql_adjuster', () => {
  describe('transformRequest', () => {
    it('should create the correct graphql request', async () => {
      const value = { a: 1, b: 2, c: 3 }
      const finalValue = await transformRequest('test query', 'test operation', ['a', 'b', 'd'])({
        value,
        typeName: 'test',
        context: {} as definitions.deploy.ChangeAndExtendedContext,
      })
      expect(finalValue).toEqual({
        value: {
          query: 'test query',
          operationName: 'test operation',
          variables: { a: 1, b: 2 },
        },
      })
    })

    it('should throw an error if the value is not an object', async () => {
      await expect(
        transformRequest('test', 'test', ['a', 'b'])({
          value: 'test',
          typeName: 'test',
          context: {} as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow('unexpected value for graphql item, not transforming')
    })
  })

  describe('transformResponse', () => {
    it('should extract the id from the graphql response', async () => {
      const value = { data: { test: [{ id: 1 }] } }
      const finalValue = await transformResponse('test')({
        value,
        typeName: 'test',
        context: { change: { action: 'add' } } as definitions.deploy.ChangeAndExtendedContext,
      })
      expect(finalValue).toEqual({ value: { id: 1 } })
    })

    it('should throw an error if the graphql response is missing an id and not removal change', async () => {
      const value = { data: { test: [{ notId: 1 }] } }
      await expect(
        transformResponse('test')({
          value,
          typeName: 'test',
          context: { change: { action: 'add' } } as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow('unexpected value without id for graphql item, not transforming')
    })

    it('should return the value if the graphql response is missing an id and is a removal change', async () => {
      const value = { data: { test: [{ notId: 1 }] } }
      const finalValue = await transformResponse('test')({
        value,
        typeName: 'test',
        context: { change: { action: 'remove' } } as definitions.deploy.ChangeAndExtendedContext,
      })
      expect(finalValue).toEqual({ value: [{ value: { notId: 1 } }] })
    })

    it('should throw an error if the value is not an object', async () => {
      await expect(
        transformResponse('test')({
          value: 'test',
          typeName: 'test',
          context: {} as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow('unexpected value for graphql item, not transforming')
    })

    it('should throw an error if the graphql response contains errors', async () => {
      const value = { errors: 'error' }
      await expect(
        transformResponse('test')({
          value,
          typeName: 'test',
          context: {} as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow(`graphql response contained errors: ${inspectValue(value)}`)
    })

    it('should throw an error if the graphql response has more than one element', async () => {
      const value = { data: { test: [{ a: 1 }, { b: 2 }] } }
      await expect(
        transformResponse('test')({
          value,
          typeName: 'test',
          context: {} as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow('unexpected response amount for graphql item, not transforming:')
    })
  })
})
