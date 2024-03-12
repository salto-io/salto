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
import { ElemID, InstanceElement, ObjectType, isEqualElements } from '@salto-io/adapter-api'
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
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: {
            myType: {
              resource: {
                directFetch: true,
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
          },
        }),
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
        'myAdapter.myType.instance.A',
        'myAdapter.myType.instance.CCC',
      ])
    })
    it('should omit nulls and undefined values from instances and nacl-case field names', () => {
      const res = generateInstancesWithInitialTypes({
        adapterName: 'myAdapter',
        entries: [{ str: 'A', nullVal: null, missing: undefined, 'with spaces': 'a' }],
        typeName: 'myType',
        defQuery: queryWithDefault<InstanceFetchApiDefinitions, string>({
          customizations: {
            myType: { element: { topLevel: { isTopLevel: true } } },
          },
        }),
      })
      expect(res.errors).toBeUndefined()
      expect(res.instances).toHaveLength(1)
      expect(res.types).toHaveLength(1)
      expect(res.types.map(e => e.elemID.getFullName())).toEqual(['myAdapter.myType'])
      expect(Object.keys(res.types[0].fields).sort()).toEqual(['missing', 'nullVal', 'str', 'with_spaces@s'])
      expect(res.instances[0].value).toEqual({ str: 'A', 'with_spaces@s': 'a' })
    })
  })
})
