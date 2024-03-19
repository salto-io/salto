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
import {
  DefaultWithCustomizations,
  mergeSingleDefWithDefault,
  queryWithDefault,
  mergeWithDefault,
  getNestedWithDefault,
  DefQuery,
  mergeWithUserElemIDDefinitions,
} from '../../../src/definitions/system'
import { FetchApiDefinitions } from '../../../src/definitions/system/fetch'

describe('system definitions utils', () => {
  let defs: DefaultWithCustomizations<unknown>
  let defsDefaultOnly: DefaultWithCustomizations<unknown>
  beforeEach(() => {
    defs = {
      default: {
        a: 'a',
        b: { c: 'd' },
        arr: { x: 1, y: 2 },
        arr2: [{ x: 1, y: 2 }],
      },
      customizations: {
        k1: {
          a: 'override',
          arr: [{ a: 'a' }, { b: 'b', x: 7 }],
          arr2: [{ a: 'a' }],
        },
        k2: {
          b: 'different type',
          arr: [],
        },
      },
    }
    defsDefaultOnly = {
      default: {
        a: 'a',
        b: { c: 'd' },
        arr: [{ x: 1, y: 2 }],
      },
    }
  })

  describe('mergeSingleDefWithDefault', () => {
    it('should return the default when no custom definition is provided', () => {
      expect(mergeSingleDefWithDefault(defs.default, undefined)).toEqual(defs.default)
    })
    it('should return the custom definition when no default is provided', () => {
      expect(mergeSingleDefWithDefault(undefined, defs.customizations?.k1)).toEqual(defs.customizations?.k1)
    })
    it('should give precedence to the custom definition', () => {
      expect(_.get(mergeSingleDefWithDefault(defs.default, defs.customizations?.k1), 'a')).toEqual('override')
    })
    it('should apply default to all array items if default is not an array', () => {
      expect(_.get(mergeSingleDefWithDefault(defs.default, defs.customizations?.k1), 'arr')).toEqual([
        { a: 'a', x: 1, y: 2 },
        { b: 'b', x: 7, y: 2 },
      ])
      expect(_.get(mergeSingleDefWithDefault(defs.default, defs.customizations?.k2), 'arr')).toEqual([])
    })
    it('should ignore default if customization and default are both arrays', () => {
      expect(_.get(mergeSingleDefWithDefault(defs.default, defs.customizations?.k1), 'arr2')).toEqual([{ a: 'a' }])
      expect(_.get(mergeSingleDefWithDefault(defs.default, defs.customizations?.k2), 'arr')).toEqual([])
    })
    it('should not crash on type conflict', () => {
      expect(mergeSingleDefWithDefault(defs.default, defs.customizations?.k2)).toEqual({
        a: 'a',
        b: 'different type',
        arr: [],
        arr2: [{ x: 1, y: 2 }],
      })
    })
    it('should ignore default for fieldCustomizations if ignoreDefaultFieldCustomizations=true', () => {
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mergeSingleDefWithDefault<any, string>(
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
        ),
      ).toEqual({
        fieldCustomizations: {
          a: { omit: true },
        },
      })
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mergeSingleDefWithDefault<any, string>(
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
        ),
      ).toEqual({
        nested: {
          fieldCustomizations: {
            a: { omit: true },
          },
        },
      })
    })
    it('should not ignore default for fieldCustomizations if ignoreDefaultFieldCustomizations=false', () => {
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mergeSingleDefWithDefault<any, string>(
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
        ),
      ).toEqual({
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
          arr2: [{ a: 'a' }],
        },
        k2: {
          a: 'a',
          b: 'different type',
          arr: [],
          arr2: [{ x: 1, y: 2 }],
        },
      })
    })
  })

  describe('getNestedWithDefault', () => {
    it('should return the nested paths in both default and customization', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getNestedWithDefault<any, any, string>(defs, 'a')).toEqual({
        default: 'a',
        customizations: {
          k1: 'override',
          k2: undefined,
        },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getNestedWithDefault<any, any, string>(defs, 'b.c')).toEqual({
        default: 'd',
        customizations: {
          k1: undefined,
          k2: undefined,
        },
      })
    })
    it('should return undefined when path is missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getNestedWithDefault<any, any, string>(defs, 'nonexistent')).toEqual({
        default: undefined,
        customizations: {
          k1: undefined,
          k2: undefined,
        },
      })
    })
  })

  describe('queryWithDefault', () => {
    let query: DefQuery<unknown>
    describe('when there are default and customizations', () => {
      beforeEach(() => {
        query = queryWithDefault(defs)
      })
      describe('allKeys', () => {
        it('should get all keys correctly', () => {
          expect(_.sortBy(query.allKeys())).toEqual(['k1', 'k2'])
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
            arr2: [{ a: 'a' }],
          })
        })
      })
    })
    describe('when there are default only', () => {
      beforeEach(() => {
        query = queryWithDefault(defsDefaultOnly)
      })
      it('should return empty list when there are no customizations', () => {
        expect(query.allKeys()).toEqual([])
      })
      it('should return default when queried on a non-existing key', () => {
        expect(query.query('missing')).toEqual(defsDefaultOnly.default)
      })
    })
  })

  describe('mergeWithUserElemIDDefinitions', () => {
    let mergedDef: FetchApiDefinitions<{
      customNameMappingOptions: 'defaultMapping' | 'systemMapping' | 'otherMapping'
    }>

    beforeAll(() => {
      mergedDef = mergeWithUserElemIDDefinitions({
        fetchConfig: {
          instances: {
            default: {
              element: {
                topLevel: {
                  elemID: {
                    parts: [{ fieldName: 'something else', mapping: 'defaultMapping' }],
                  },
                },
              },
            },
            customizations: {
              type1: {
                element: {
                  topLevel: {
                    isTopLevel: true,
                    elemID: {
                      parts: [{ fieldName: 'a', mapping: 'systemMapping' }],
                      delimiter: 'X',
                    },
                  },
                },
              },
              type2: {
                element: {
                  topLevel: {
                    isTopLevel: true,
                    elemID: {
                      parts: [{ fieldName: 'a', mapping: 'systemMapping' }],
                    },
                  },
                },
              },
              type3: {
                element: {
                  topLevel: {
                    isTopLevel: true,
                    elemID: {
                      parts: [{ fieldName: 'a', mapping: 'lowercase' }],
                    },
                  },
                },
              },
            },
          },
          customNameMappingFunctions: {
            defaultMapping: name => `${name}Default`,
            systemMapping: name => `${name}System`,
            otherMapping: name => `${name}Other`,
          },
        },
        userElemID: {
          type1: {
            parts: [{ fieldName: 'b', mapping: 'otherMapping' }],
          },
          type3: {
            parts: [{ fieldName: 'b' }],
            extendSystemPartsDefinition: true,
          },
          type4: {
            parts: [{ fieldName: 'b' }],
          },
        },
      })
    })

    it('should merge user config with system customization and and only use user-defined parts, with preference for user config, for types that contain both definitions', () => {
      expect(mergedDef.instances.customizations?.type1).toEqual({
        element: {
          topLevel: {
            isTopLevel: true,
            elemID: {
              parts: [{ fieldName: 'b', mapping: 'otherMapping' }],
              delimiter: 'X',
            },
          },
        },
      })
    })
    it('should use system config when type is not part of user config', () => {
      expect(mergedDef.instances.customizations?.type2).toEqual({
        element: {
          topLevel: {
            isTopLevel: true,
            elemID: {
              parts: [{ fieldName: 'a', mapping: 'systemMapping' }],
            },
          },
        },
      })
    })
    it('should merge user config with system customization and concatenate the parts if the user config has extendSystemPartsDefinition=true', () => {
      expect(mergedDef.instances.customizations?.type3).toEqual({
        element: {
          topLevel: {
            isTopLevel: true,
            elemID: {
              parts: [{ fieldName: 'a', mapping: 'lowercase' }, { fieldName: 'b' }],
            },
          },
        },
      })
    })
    it('should use user config when type does not have a system customization for elem ids', () => {
      expect(mergedDef.instances.customizations?.type4).toEqual({
        element: {
          topLevel: {
            elemID: {
              parts: [{ fieldName: 'b' }],
            },
          },
        },
      })
    })
    it('should not modify system default', () => {
      expect(mergedDef.instances.default?.element?.topLevel?.elemID).toEqual({
        parts: [{ fieldName: 'something else', mapping: 'defaultMapping' }],
      })
    })
  })
})
