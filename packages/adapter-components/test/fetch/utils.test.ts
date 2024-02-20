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
import _ from 'lodash'
import { Values } from '@salto-io/adapter-api'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { ContextParams, GeneratedItem } from '../../src/definitions/system/shared'
import { createValueTransformer } from '../../src/fetch/utils'

describe('fetch utils', () => {
  describe('createValueTransformer', () => {
    let item: GeneratedItem<ContextParams, Values>
    beforeAll(() => {
      item = {
        context: {},
        typeName: 't',
        value: {
          a: {
            x: 'X',
            z: [
              {
                something: true,
              },
            ],
          },
          other: 'other',
        },
      }
    })
    describe('when def combines multiple args', () => {
      it('should transform values based on the privided definitions', () => {
        const func = createValueTransformer({ root: 'a', nestUnderField: 'b', pick: ['x', 'y', 'z'], omit: ['z'] })
        expect(func(item)).toEqual([
          {
            context: {},
            typeName: 't',
            value: {
              b: {
                x: 'X',
              },
            },
          },
        ])
      })
      it('should not modify item if no customizations are provided, but still convert to array', () => {
        expect(createValueTransformer({})(item)).toEqual([item])
        expect(createValueTransformer()(item)).toEqual([item])
      })
      it('should apply adjust after the other steps, and add context and typeName if not returned from adjust', () => {
        const func = createValueTransformer({
          root: 'a',
          nestUnderField: 'b',
          pick: ['x', 'z'],
          adjust: ({ value }) => ({
            value: lowerdashValues.isPlainObject(value) ? _.mapKeys(value, (_v, key) => key.toUpperCase()) : 'unknown',
          }),
        })
        expect(func(item)).toEqual([
          {
            context: {},
            typeName: 't',
            value: {
              B: {
                x: 'X',
                z: [
                  {
                    something: true,
                  },
                ],
              },
            },
          },
        ])
      })
      it('should give precedence to properties returned from adjust', () => {
        const func = createValueTransformer({
          adjust: ({ value, context, typeName }) => ({
            context,
            typeName,
            value: lowerdashValues.isPlainObject(value) ? _.mapKeys(value, (_v, key) => key.toUpperCase()) : 'unknown',
          }),
        })
        expect(func(item)).toEqual([
          {
            context: {},
            typeName: 't',
            value: {
              A: {
                x: 'X',
                z: [
                  {
                    something: true,
                  },
                ],
              },
              OTHER: 'other',
            },
          },
        ])
      })
      it('should return a single item if single=true and item has single value', () => {
        const func = createValueTransformer({ root: 'a', omit: ['z'], single: true })
        expect(func(item)).toEqual({
          context: {},
          typeName: 't',
          value: {
            x: 'X',
          },
        })
      })
      it('should return undefined if single=true and item array is empty', () => {
        const func = createValueTransformer({ root: 'a', single: true })
        expect(func({ context: {}, typeName: 't', value: { a: [] } })).toBeUndefined()
      })
      it('should return first value if single=true and item array is longer', () => {
        const func = createValueTransformer({ root: 'a', single: true })
        expect(func({ context: {}, typeName: 't', value: { a: [1, 2] } })).toEqual({
          context: {},
          typeName: 't',
          value: 1,
        })
      })
    })
  })
})
