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
import { DefaultWithCustomizations, mergeSingleDefWithDefault, queryWithDefault, mergeWithDefault, mergeNestedWithDefault, DefQuery } from '../../../src/definitions/system'

describe('system definitions utils', () => {
  let defs: DefaultWithCustomizations<unknown>
  beforeEach(() => {
    defs = {
      default: {
        a: 'a',
        b: { c: 'd' },
        arr: { x: 1, y: 2 },
      },
      customizations: {
        k1: {
          a: 'override',
          arr: [
            { a: 'a' },
            { b: 'b', x: 7 },
          ],
        },
        k2: {
          b: 'different type',
          arr: [],
        },
      },
    }
  })

  describe('mergeSingleDefWithDefault', () => {
    it('should return the default when no custom definition is provided', () => {
      expect(mergeSingleDefWithDefault(defs.default, undefined)).toEqual(defs.default)
    })
    it('should return the custom definition when no default is provided', () => {
      expect(mergeSingleDefWithDefault(undefined, defs.customizations.k1)).toEqual(defs.customizations.k1)
    })
    it('should give precedence to the custom definition', () => {
      expect(_.get(mergeSingleDefWithDefault(defs.default, defs.customizations.k1), 'a')).toEqual('override')
    })
    it('should apply default to all array items', () => {
      expect(_.get(mergeSingleDefWithDefault(defs.default, defs.customizations.k1), 'arr')).toEqual([
        { a: 'a', x: 1, y: 2 },
        { b: 'b', x: 7, y: 2 },
      ])
      expect(_.get(mergeSingleDefWithDefault(defs.default, defs.customizations.k2), 'arr')).toEqual([])
    })
    it('should not crash on type conflict', () => {
      expect(mergeSingleDefWithDefault(defs.default, defs.customizations.k2)).toEqual({
        a: 'a',
        b: 'different type',
        arr: [],
      })
    })
    it('should ignore default for fieldCustomizations if ignoreDefaultFieldCustomizations=true', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(mergeSingleDefWithDefault<any, string>(
        {
          fieldCustomizations: {
            a: { hide: true },
          },
        },
        {
          fieldCustomizations: {
            a: { omit: true },
          },
          ignoreDefaultFieldCustomizations: true,
        },
      )).toEqual({
        fieldCustomizations: {
          a: { omit: true },
        },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(mergeSingleDefWithDefault<any, string>(
        {
          nested: {
            fieldCustomizations: {
              a: { hide: true },
            },
          },
        },
        {
          nested: {
            fieldCustomizations: {
              a: { omit: true },
            },
            ignoreDefaultFieldCustomizations: true,
          },
        },
      )).toEqual({
        nested: {
          fieldCustomizations: {
            a: { omit: true },
          },
        },
      })
    })
    it('should not ignore default for fieldCustomizations if ignoreDefaultFieldCustomizations=false', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(mergeSingleDefWithDefault<any, string>(
        {
          fieldCustomizations: {
            a: { hide: true },
          },
        },
        {
          fieldCustomizations: {
            a: { omit: true },
          },
          ignoreDefaultFieldCustomizations: false,
        },
      )).toEqual({
        fieldCustomizations: {
          a: { hide: true, omit: true },
        },
      })
    })
  })

  describe('mergeWithDefault', () => {
    it('should merge definitions like mergeSingleDefWithDefault would on each key', () => {
      expect(mergeWithDefault(defs)).toEqual({
        k1: {
          a: 'override',
          b: { c: 'd' },
          arr: [
            { a: 'a', x: 1, y: 2 },
            { b: 'b', x: 7, y: 2 },
          ],
        },
        k2: {
          a: 'a',
          b: 'different type',
          arr: [],
        },
      })
    })
  })

  describe('mergeNestedWithDefault', () => {
    it('should return the merged value in nested paths', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(mergeNestedWithDefault<any, any, string>(defs, 'a')).toEqual({
        k1: 'override',
        k2: 'a',
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(mergeNestedWithDefault<any, any, string>(defs, 'b.c')).toEqual({
        k1: 'd',
        k2: 'd',
      })
    })
    it('should return undefined when path is missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(mergeNestedWithDefault<any, any, string>(defs, 'nonexistent')).toEqual({
        k1: undefined,
        k2: undefined,
      })
    })
  })

  describe('queryWithDefault', () => {
    let query: DefQuery<unknown>
    beforeEach(() => {
      query = queryWithDefault(defs)
    })

    describe('allKeys', () => {
      it('should get all keys correctly', () => {
        expect(_.sortBy(query.allKeys())).toEqual(['k1', 'k2'])
      })
      it('should return empty list when there are no customizations', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(queryWithDefault<any>({ default: {}, customizations: {} }).allKeys()).toEqual([])
      })
    })
    describe('getAll', () => {
      it('should be identical to mergeWithDefault', () => {
        expect(query.getAll()).toEqual(mergeWithDefault(defs))
      })
    })
    describe('query', () => {
      it('should merge correctly when queried on an existing key', () => {
        expect(query.query('k1')).toEqual({
          a: 'override',
          b: { c: 'd' },

          arr: [
            { a: 'a', x: 1, y: 2 },
            { b: 'b', x: 7, y: 2 },
          ],
        })
      })
      it('should return default when queried on a non-existing key', () => {
        expect(query.query('missing')).toEqual(defs.default)
      })
    })
  })
})
