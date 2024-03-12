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
  ElemID,
  InstanceElement,
  ObjectType,
  isEqualElements,
  isInstanceElement,
  isObjectType,
} from '@salto-io/adapter-api'
import { getElementGenerator } from '../../../src/fetch/element/element'
import { queryWithDefault } from '../../../src/definitions'
import { createMockQuery } from '../../../src/fetch/query'
import { InstanceFetchApiDefinitions } from '../../../src/definitions/system/fetch'

describe('element', () => {
  const typeID = new ElemID('myAdapter', 'myType')
  describe('getElementGenerator', () => {
    it('should create empty type with no instances when no entries or defs are provided', () => {
      const generator = getElementGenerator({
        adapterName: 'myAdapter',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: { myType: { element: { topLevel: { isTopLevel: true } } } },
        }),
        fetchQuery: createMockQuery(),
      })
      generator.pushEntries({
        entries: [],
        typeName: 'myType',
      })
      const res = generator.generate()
      expect(res.errors).toEqual([])
      expect(res.elements).toHaveLength(1)
      expect(res.elements[0].isEqual(new ObjectType({ elemID: typeID, fields: {} }))).toEqual(true)
    })
    it('should not throw when type is not marked as top-level', () => {
      const generator = getElementGenerator({
        adapterName: 'myAdapter',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: { myType: { element: { topLevel: { isTopLevel: true } } } },
        }),
        fetchQuery: createMockQuery(),
      })
      generator.pushEntries({
        entries: [],
        typeName: 'myType',
      })
      const res = generator.generate()
      expect(res.errors).toEqual([])
      expect(res.elements.length).toBe(1)
      expect(res.elements.map(e => e.elemID.getFullName())).toEqual(['myAdapter.myType'])
    })
    it('should create instances and matching type when entries are provided and no defs', () => {
      const entries = [
        { str: 'A', num: 2, arr: [{ st: 'X', unknown: true }] },
        { str: 'CCC', arr: [{ unknown: 'text' }] },
      ]
      const generator = getElementGenerator({
        adapterName: 'myAdapter',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: { myType: { element: { topLevel: { isTopLevel: true } } } },
        }),
        fetchQuery: createMockQuery(),
      })
      generator.pushEntries({
        entries,
        typeName: 'myType',
      })
      const res = generator.generate()
      expect(res.errors).toEqual([])
      expect(res.elements).toHaveLength(4)
      expect(res.elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'myAdapter.myType',
        'myAdapter.myType.instance.unnamed_0',
        'myAdapter.myType.instance.unnamed_1',
        'myAdapter.myType__arr',
      ])
      const objType = res.elements
        .filter(isObjectType)
        .find(e => e.elemID.getFullName() === 'myAdapter.myType') as ObjectType
      const subType = res.elements.filter(isObjectType).find(e => e.elemID.getFullName() === 'myAdapter.myType__arr')
      expect(_.mapValues(objType?.fields, f => f.getTypeSync().elemID.name)).toEqual({
        str: 'string',
        num: 'number',
        arr: 'List<myAdapter.myType__arr>',
      })
      expect(_.mapValues(subType?.fields, f => f.getTypeSync().elemID.name)).toEqual({
        st: 'string',
        unknown: 'unknown',
      })
      expect(
        isEqualElements(
          res.elements.filter(isInstanceElement).find(e => e.elemID.name === 'unnamed_0'),
          new InstanceElement('unnamed_0', objType, entries[0], []),
        ),
      ).toBeTruthy()
      expect(
        isEqualElements(
          res.elements.filter(isInstanceElement).find(e => e.elemID.name === 'unnamed_1'),
          new InstanceElement('unnamed_1', objType, entries[1], []),
        ),
      ).toBeTruthy()
    })
    it('should create instances and matching type based on defined customizations', () => {
      const entries = [
        { str: 'A', num: 2, arr: [{ st: 'X', unknown: true }] },
        { str: 'CCC', arr: [{ unknown: 'text' }] },
      ]
      const generator = getElementGenerator({
        adapterName: 'myAdapter',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: {
            myType: {
              resource: {
                directFetch: true,
                serviceIDFields: ['str'],
              },
              element: {
                topLevel: {
                  isTopLevel: true,
                  elemID: {
                    parts: [{ fieldName: 'str' }],
                  },
                },
              },
            },
            myType__arr: {
              element: {
                fieldCustomizations: {
                  unknown: {
                    fieldType: 'boolean',
                  },
                },
              },
            },
          },
        }),
        fetchQuery: createMockQuery(),
      })
      generator.pushEntries({
        entries,
        typeName: 'myType',
      })
      const res = generator.generate()
      expect(res.errors).toEqual([])
      expect(res.elements).toHaveLength(4)
      expect(res.elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'myAdapter.myType',
        'myAdapter.myType.instance.A',
        'myAdapter.myType.instance.CCC',
        'myAdapter.myType__arr',
      ])
      const objType = res.elements
        .filter(isObjectType)
        .find(e => e.elemID.getFullName() === 'myAdapter.myType') as ObjectType
      const subType = res.elements.filter(isObjectType).find(e => e.elemID.getFullName() === 'myAdapter.myType__arr')
      expect(_.mapValues(objType?.fields, f => f.getTypeSync().elemID.name)).toEqual({
        str: 'serviceid',
        num: 'number',
        arr: 'List<myAdapter.myType__arr>',
      })
      expect(_.mapValues(subType?.fields, f => f.getTypeSync().elemID.name)).toEqual({
        st: 'string',
        unknown: 'boolean',
      })
      expect(
        isEqualElements(
          res.elements.filter(isInstanceElement).find(e => e.elemID.name === 'A'),
          new InstanceElement('A', objType, entries[0], []),
        ),
      ).toBeTruthy()
      expect(
        isEqualElements(
          res.elements.filter(isInstanceElement).find(e => e.elemID.name === 'CCC'),
          new InstanceElement('CCC', objType, entries[1], []),
        ),
      ).toBeTruthy()
    })
  })
})
