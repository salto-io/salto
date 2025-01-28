/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ElemID,
  InstanceElement,
  ObjectType,
  isEqualElements,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { generateInstancesWithInitialTypes } from '../../../src/fetch/element/instance_element'
import { queryWithDefault } from '../../../src/definitions'
import { InstanceFetchApiDefinitions } from '../../../src/definitions/system/fetch'

describe('instance element', () => {
  const typeID = new ElemID('myAdapter', 'myType')
  describe('generateInstancesWithInitialTypes', () => {
    it('should create empty type with no instances when no entries or defs are provided', () => {
      const res = generateInstancesWithInitialTypes({
        adapterName: 'myAdapter',
        entries: [],
        typeName: 'myType',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: { myType: { element: { topLevel: { isTopLevel: true } } } },
        }),
        customNameMappingFunctions: {},
        definedTypes: {},
      })
      expect(res.errors).toBeUndefined()
      expect(res.instances).toHaveLength(0)
      expect(res.types).toHaveLength(1)
      expect(res.typesAreFinal).toBeFalsy()
      expect(res.types[0].isEqual(new ObjectType({ elemID: typeID, fields: {} }))).toEqual(true)
    })
    it('should throw when type is not marked as top-level', () => {
      expect(() =>
        generateInstancesWithInitialTypes({
          adapterName: 'myAdapter',
          entries: [],
          typeName: 'myType',
          defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({ customizations: {} }),
          customNameMappingFunctions: {},
          definedTypes: {},
        }),
      ).toThrow('type myAdapter:myType is not defined as top-level, cannot create instances')
    })
    it('should create instances and matching type when entries are provided and no defs', () => {
      const entries = [
        { str: 'A', num: 2, arr: [{ st: 'X', unknown: true }] },
        { str: 'CCC', arr: [{ unknown: 'text' }] },
      ]
      const res = generateInstancesWithInitialTypes({
        adapterName: 'myAdapter',
        entries,
        typeName: 'myType',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: { myType: { element: { topLevel: { isTopLevel: true } } } },
        }),
        customNameMappingFunctions: {},
        definedTypes: {},
      })
      expect(res.errors).toBeUndefined()
      expect(res.instances).toHaveLength(2)
      expect(res.types).toHaveLength(2)
      expect(res.types.map(e => e.elemID.getFullName())).toEqual(['myAdapter.myType', 'myAdapter.myType__arr'])
      const [objType, subType] = res.types
      expect(_.mapValues(objType.fields, f => f.getTypeSync().elemID.name)).toEqual({
        str: 'string',
        num: 'number',
        arr: 'List<myAdapter.myType__arr>',
      })
      expect(_.mapValues(subType.fields, f => f.getTypeSync().elemID.name)).toEqual({
        st: 'string',
        unknown: 'unknown',
      })
      expect(res.instances.map(e => e.elemID.getFullName()).sort()).toEqual([
        'myAdapter.myType.instance.unnamed_0',
        'myAdapter.myType.instance.unnamed_1',
      ])
      expect(
        isEqualElements(
          res.instances.find(e => e.elemID.name === 'unnamed_0'),
          new InstanceElement('unnamed_0', objType, entries[0], []),
        ),
      ).toBeTruthy()
      expect(
        isEqualElements(
          res.instances.find(e => e.elemID.name === 'unnamed_1'),
          new InstanceElement('unnamed_1', objType, entries[1], []),
        ),
      ).toBeTruthy()
    })
    it('should create instances and matching type based on defined customizations', () => {
      const res = generateInstancesWithInitialTypes({
        adapterName: 'myAdapter',
        entries: [
          { str: 'A', num: 2, arr: [{ st: 'X', unknown: true }] },
          { str: 'CCC', arr: [{ unknown: 'text' }] },
        ],
        typeName: 'myType',
        defQuery: queryWithDefault<
          InstanceFetchApiDefinitions<{ customNameMappingOptions: 'customTest' | 'Uri' }>,
          string
        >({
          customizations: {
            myType: {
              resource: {
                directFetch: true,
              },
              element: {
                topLevel: {
                  isTopLevel: true,
                  elemID: {
                    parts: [{ fieldName: 'str', mapping: 'customTest' }],
                  },
                },
              },
            },
          },
        }),
        customNameMappingFunctions: {
          customTest: name => `custom_${name}`,
          Uri: name => `uri_${name}`,
        },
        definedTypes: {},
      })
      expect(res.errors).toBeUndefined()
      expect(res.instances).toHaveLength(2)
      expect(res.types).toHaveLength(2)
      expect(res.types.map(e => e.elemID.getFullName())).toEqual(['myAdapter.myType', 'myAdapter.myType__arr'])
      const [objType, subType] = res.types
      expect(_.mapValues(objType.fields, f => f.getTypeSync().elemID.name)).toEqual({
        str: 'string',
        num: 'number',
        arr: 'List<myAdapter.myType__arr>',
      })
      expect(_.mapValues(subType.fields, f => f.getTypeSync().elemID.name)).toEqual({
        st: 'string',
        unknown: 'unknown',
      })
      expect(res.instances.map(e => e.elemID.getFullName()).sort()).toEqual([
        'myAdapter.myType.instance.custom_A',
        'myAdapter.myType.instance.custom_CCC',
      ])
    })
    it('should nacl-case field names', () => {
      const res = generateInstancesWithInitialTypes({
        adapterName: 'myAdapter',
        entries: [{ str: 'A', 'with spaces': 'a' }],
        typeName: 'myType',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: {
            myType: { element: { topLevel: { isTopLevel: true } } },
          },
        }),
        customNameMappingFunctions: {},
        definedTypes: {},
      })
      expect(res.errors).toBeUndefined()
      expect(res.instances).toHaveLength(1)
      expect(res.types).toHaveLength(1)
      expect(res.types.map(e => e.elemID.getFullName())).toEqual(['myAdapter.myType'])
      expect(Object.keys(res.types[0].fields).sort()).toEqual(['str', 'with_spaces@s'])
      expect(res.instances[0].value).toEqual({ str: 'A', 'with_spaces@s': 'a' })
    })
    it('should return fetch warning when singleton type has more than one entry', () => {
      expect(() =>
        generateInstancesWithInitialTypes({
          adapterName: 'myAdapter',
          entries: [{ str: 'A' }, { str: 'B' }],
          typeName: 'myType',
          defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
            customizations: { myType: { element: { topLevel: { isTopLevel: true, singleton: true } } } },
          }),
          customNameMappingFunctions: {},
          definedTypes: {},
        }),
      ).toThrow('Could not fetch type myType, singleton types should not have more than one instance')
    })
    it('should not return fetch warning when there are no entries for singleton type', () => {
      const res = generateInstancesWithInitialTypes({
        adapterName: 'myAdapter',
        entries: [],
        typeName: 'myType',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: { myType: { element: { topLevel: { isTopLevel: true, singleton: true } } } },
        }),
        customNameMappingFunctions: {},
        definedTypes: {},
      })
      expect(res.errors).toBeUndefined()
      expect(res.instances).toHaveLength(0)
    })
    describe('standalone fields', () => {
      it('should create standalone instances and references when standalone fields are provided', () => {
        const entries = [{ str: 'A', num: 2, nested: [{ str: 'B' }] }]
        const res = generateInstancesWithInitialTypes({
          adapterName: 'myAdapter',
          entries,
          typeName: 'myType',
          defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
            customizations: {
              myType: {
                element: {
                  topLevel: { isTopLevel: true },
                  fieldCustomizations: { nested: { standalone: { typeName: 'myType__myNestedType' } } },
                },
              },
              myType__myNestedType: { element: { topLevel: { isTopLevel: true } } },
            },
          }),
          customNameMappingFunctions: {},
          definedTypes: {},
        })
        expect(res.errors).toBeUndefined()
        expect(res.instances).toHaveLength(2)
        expect(res.types.map(e => e.elemID.getFullName())).toEqual([
          'myAdapter.myType',
          'myAdapter.myType__myNestedType',
        ])
        const [objType, subType] = res.types
        const myType = new InstanceElement('unnamed_0', objType, entries[0], [])
        const myNestedType = new InstanceElement('unnamed_0__unnamed_0', subType, entries[0].nested[0], [], {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(myType.elemID, myType)],
        })
        myType.value.nested = [new ReferenceExpression(res.instances[1].elemID, res.instances[1])]
        expect(
          isEqualElements(
            res.instances.find(e => e.elemID.typeName === 'myType'),
            myType,
          ),
        ).toBeTruthy()
        expect(
          isEqualElements(
            res.instances.find(e => e.elemID.typeName === 'myType__myNestedType'),
            myNestedType,
          ),
        ).toBeTruthy()
      })
      describe('allowEmptyArrays', () => {
        it('should remove standalone instances empty arrays when allowEmptyArrays is false', () => {
          const entries = [{ str: 'A', num: 2, nested: { str: 'B', arr: [] } }]
          const res = generateInstancesWithInitialTypes({
            adapterName: 'myAdapter',
            entries,
            typeName: 'myType',
            defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
              customizations: {
                myType: {
                  element: {
                    topLevel: { isTopLevel: true },
                    fieldCustomizations: { nested: { standalone: { typeName: 'myType__myNestedType' } } },
                  },
                },
                myType__myNestedType: { element: { topLevel: { isTopLevel: true } } },
              },
            }),
            customNameMappingFunctions: {},
            definedTypes: {},
          })
          expect(res.errors).toBeUndefined()
          expect(res.instances).toHaveLength(2)
          expect(res.instances[1].value).toEqual({ str: 'B' })
        })

        it('should keep standalone instances empty arrays when allowEmptyArrays is true', () => {
          const entries = [{ str: 'A', num: 2, nested: { str: 'B', arr: [] } }]
          const res = generateInstancesWithInitialTypes({
            adapterName: 'myAdapter',
            entries,
            typeName: 'myType',
            defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
              customizations: {
                myType: {
                  element: {
                    topLevel: { isTopLevel: true, allowEmptyArrays: true },
                    fieldCustomizations: {
                      nested: {
                        standalone: { typeName: 'myType__myNestedType' },
                      },
                    },
                  },
                },
                myType__myNestedType: { element: { topLevel: { isTopLevel: true, allowEmptyArrays: true } } },
              },
            }),
            customNameMappingFunctions: {},
            definedTypes: {},
          })
          expect(res.errors).toBeUndefined()
          expect(res.instances).toHaveLength(2)
          expect(res.instances[1].value).toEqual({ str: 'B', arr: [] })
        })
        // This should be fixed in SALTO-6584
        it('should remove standalone instances empty arrays when allowEmptyArrays is false and nested type is defined with allowEmptyArrays true', () => {
          const entries = [{ str: 'A', num: 2, nested: { str: 'B', arr: [] } }]
          const res = generateInstancesWithInitialTypes({
            adapterName: 'myAdapter',
            entries,
            typeName: 'myType',
            defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
              customizations: {
                myType: {
                  element: {
                    topLevel: { isTopLevel: true, allowEmptyArrays: false },
                    fieldCustomizations: {
                      nested: {
                        standalone: { typeName: 'myType__myNestedType' },
                      },
                    },
                  },
                },
                myType__myNestedType: { element: { topLevel: { isTopLevel: true, allowEmptyArrays: true } } },
              },
            }),
            customNameMappingFunctions: {},
            definedTypes: {},
          })
          expect(res.errors).toBeUndefined()
          expect(res.instances).toHaveLength(2)
          expect(res.instances[1].value).toEqual({ str: 'B' })
        })
      })
    })
  })
})
