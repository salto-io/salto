/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ObjectType } from '@salto-io/adapter-api'
import { createClientConfigType, validateClientConfig } from '../../../src/definitions/user/client_config'

describe('client_config', () => {
  describe('createClientConfigType', () => {
    it('should return default type when no custom buckets were added', async () => {
      const type = createClientConfigType('myAdapter')
      expect(Object.keys(type.fields)).toHaveLength(5)
      expect(type.fields.rateLimit).toBeDefined()
      expect(type.fields.retry).toBeDefined()
      expect(type.fields.pageSize).toBeDefined()
      expect(type.fields.timeout).toBeDefined()
      const rateLimitType = await type.fields.rateLimit.getType()
      expect(rateLimitType).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys((rateLimitType as ObjectType).fields))).toEqual(new Set(['get', 'total']))
    })

    it('should include additional custom buckets when added', async () => {
      const type = createClientConfigType<{
        total: number
        a: number
        b: number
      }>('myAdapter', ['a', 'b'])
      expect(Object.keys(type.fields)).toHaveLength(5)
      expect(type.fields.rateLimit).toBeDefined()
      expect(type.fields.retry).toBeDefined()
      expect(type.fields.pageSize).toBeDefined()
      expect(type.fields.timeout).toBeDefined()
      const rateLimitType = await type.fields.rateLimit.getType()
      expect(rateLimitType).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys((rateLimitType as ObjectType).fields))).toEqual(new Set(['get', 'total', 'a', 'b']))
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
