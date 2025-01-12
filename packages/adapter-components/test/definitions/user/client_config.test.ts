/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, ObjectType } from '@salto-io/adapter-api'
import { createClientConfigType, validateClientConfig } from '../../../src/definitions/user/client_config'

describe('client_config', () => {
  describe('createClientConfigType', () => {
    it('should return default type when no custom buckets were added', async () => {
      const type = createClientConfigType({ adapter: 'myAdapter' })
      expect(Object.keys(type.fields)).toHaveLength(8)
      expect(type.fields.rateLimit).toBeDefined()
      expect(type.fields.retry).toBeDefined()
      expect(type.fields.pageSize).toBeDefined()
      expect(type.fields.timeout).toBeDefined()
      expect(type.fields.logging).toBeDefined()
      const rateLimitType = await type.fields.rateLimit.getType()
      expect(rateLimitType).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys((rateLimitType as ObjectType).fields))).toEqual(new Set(['get', 'total']))
    })

    it('should include additional custom buckets when added', async () => {
      const type = createClientConfigType<{
        total: number
        a: number
        b: number
      }>({ adapter: 'myAdapter', bucketNames: ['a', 'b'] })
      expect(Object.keys(type.fields)).toHaveLength(8)
      expect(type.fields.rateLimit).toBeDefined()
      expect(type.fields.retry).toBeDefined()
      expect(type.fields.pageSize).toBeDefined()
      expect(type.fields.timeout).toBeDefined()
      expect(type.fields.logging).toBeDefined()
      const rateLimitType = await type.fields.rateLimit.getType()
      expect(rateLimitType).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys((rateLimitType as ObjectType).fields))).toEqual(new Set(['get', 'total', 'a', 'b']))
    })
    describe('with additional fields provided', () => {
      it('should add additional client fields when provided', () => {
        const type = createClientConfigType<{
          total: number
          a: number
          b: number
        }>({
          adapter: 'myAdapter',
          additionalClientFields: {
            myField: { refType: BuiltinTypes.BOOLEAN },
            anotherField: {
              refType: new ObjectType({
                elemID: new ElemID('adapter', 'test'),
                fields: { a: { refType: BuiltinTypes.STRING } },
              }),
            },
          },
        })
        expect(Object.keys(type.fields)).toHaveLength(10)
        expect(type.fields.myField).toBeDefined()
        const myFields = type.fields.myField.getTypeSync()
        expect(myFields).toBe(BuiltinTypes.BOOLEAN)
        expect(type.fields.anotherField).toBeDefined()
        const anotherType = type.fields.anotherField.getTypeSync() as ObjectType
        expect(anotherType.elemID.getFullName()).toEqual('adapter.test')
        expect(anotherType.fields.a).toBeDefined()
      })
      it('should add additional rate limit fields when provided', async () => {
        const type = createClientConfigType<{
          total: number
          a: number
          b: number
        }>({
          adapter: 'myAdapter',
          additionRateLimitFields: {
            myField: { refType: BuiltinTypes.BOOLEAN },
          },
        })
        expect(Object.keys(type.fields)).toHaveLength(8)
        const rateLimitType = (await type.fields.rateLimit.getType()) as ObjectType
        expect(rateLimitType.fields.myField).toBeDefined()
      })
    })
  })

  describe('validateClientConfig', () => {
    it('should validate successfully when values are valid', () => {
      expect(() =>
        validateClientConfig<{
          total: number
          get: number
          a: number
          b: number
        }>('PATH', {
          rateLimit: {
            total: -1,
            get: 2,
            a: 2,
            b: 3,
          },
        }),
      ).not.toThrow()
    })
    it('should validate successfully when one of the values is 0', () => {
      expect(() =>
        validateClientConfig<{
          total: number
          get: number
          a: number
          b: number
        }>('PATH', {
          rateLimit: {
            total: -1,
            get: 0,
            a: 0,
            b: 3,
          },
        }),
      ).toThrow(new Error('PATH.rateLimit values cannot be set to 0. Invalid keys: get, a'))
    })
  })
})
