/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
          moveMe: {
            val: 'val',
          },
          other: 'other',
        },
      }
    })
    describe('when def combines multiple args', () => {
      it('should transform values based on the provided definitions', async () => {
        const func = createValueTransformer({
          root: 'a',
          nestUnderField: 'b',
          pick: ['x', 'y', 'z', 'moved'],
          omit: ['z'],
          rename: [{ from: 'moveMe', to: 'a.moved', onConflict: 'override' }],
        })
        expect(await func(item)).toEqual([
          {
            context: {},
            typeName: 't',
            value: {
              b: {
                x: 'X',
                moved: {
                  val: 'val',
                },
              },
            },
          },
        ])
      })
      it('should not modify item if no customizations are provided, but still convert to array', async () => {
        expect(await createValueTransformer({})(item)).toEqual([item])
        expect(await createValueTransformer()(item)).toEqual([item])
      })
      it('should apply adjust after the other steps, and add context and typeName if not returned from adjust', async () => {
        const func = createValueTransformer({
          root: 'a',
          nestUnderField: 'b',
          pick: ['x', 'z'],
          adjust: async ({ value }) => ({
            value: lowerdashValues.isPlainObject(value) ? _.mapKeys(value, (_v, key) => key.toUpperCase()) : 'unknown',
          }),
        })
        expect(await func(item)).toEqual([
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
      it('should not override value on rename if onConflict = skip', async () => {
        const func = createValueTransformer({
          rename: [{ from: 'a', to: 'b', onConflict: 'skip' }],
        })
        expect(await func({ value: { a: 'a', b: 'b' }, typeName: 'a', context: {} })).toEqual([
          {
            context: {},
            typeName: 'a',
            value: {
              a: 'a',
              b: 'b',
            },
          },
        ])
      })
      it('should override value on rename if onConflict = override', async () => {
        const func = createValueTransformer({
          rename: [{ from: 'a', to: 'b', onConflict: 'override' }],
        })
        expect(await func({ value: { a: 'a', b: 'b' }, typeName: 'a', context: {} })).toEqual([
          {
            context: {},
            typeName: 'a',
            value: {
              b: 'a',
            },
          },
        ])
      })
      it('should omit "from" value on rename if onConflict = omit', async () => {
        const func = createValueTransformer({
          rename: [{ from: 'a', to: 'b', onConflict: 'omit' }],
        })
        expect(await func({ value: { a: 'a', b: 'b' }, typeName: 'a', context: {} })).toEqual([
          {
            context: {},
            typeName: 'a',
            value: {
              b: 'b',
            },
          },
        ])
      })

      it('should give precedence to properties returned from adjust', async () => {
        const func = createValueTransformer({
          adjust: async ({ value, context, typeName }) => ({
            context,
            typeName,
            value: lowerdashValues.isPlainObject(value) ? _.mapKeys(value, (_v, key) => key.toUpperCase()) : 'unknown',
          }),
        })
        expect(await func(item)).toEqual([
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
              MOVEME: {
                val: 'val',
              },
            },
          },
        ])
      })
      it('should support returning multiple values from adjust', async () => {
        const func = createValueTransformer({
          adjust: async () => [{ value: { a: 1 } }, { value: { b: 2 } }, { value: { c: 3 } }],
        })
        expect(await func(item)).toEqual([
          {
            context: {},
            typeName: 't',
            value: { a: 1 },
          },
          {
            context: {},
            typeName: 't',
            value: { b: 2 },
          },
          {
            context: {},
            typeName: 't',
            value: { c: 3 },
          },
        ])
      })
      it('should support returning multiple items from adjust', async () => {
        const func = createValueTransformer({
          adjust: async () => [{ value: { a: 1 }, typeName: 'custom' }, { value: { b: 2 } }],
        })
        expect(await func(item)).toEqual([
          {
            context: {},
            typeName: 'custom',
            value: { a: 1 },
          },
          {
            context: {},
            typeName: 't',
            value: { b: 2 },
          },
        ])
      })

      it('should return a single item if single=true and item has single value', async () => {
        const func = createValueTransformer({ root: 'a', omit: ['z'], single: true })
        expect(await func(item)).toEqual({
          context: {},
          typeName: 't',
          value: {
            x: 'X',
          },
        })
      })
      it('should return undefined if single=true and item array is empty', async () => {
        const func = createValueTransformer({ root: 'a', single: true })
        expect(await func({ context: {}, typeName: 't', value: { a: [] } })).toBeUndefined()
      })
      it('should return first value if single=true and item array is longer', async () => {
        const func = createValueTransformer({ root: 'a', single: true })
        expect(await func({ context: {}, typeName: 't', value: { a: [1, 2] } })).toEqual({
          context: {},
          typeName: 't',
          value: 1,
        })
      })
    })
  })
})
