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

import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import {
  createServiceIDs,
  serviceIDKeyCreator,
  createElemIDFunc,
  getElemPath,
} from '../../../src/fetch/element/id_utils'

describe('id utils', () => {
  const typeID = new ElemID('myAdapter', 'myType')
  describe('createServiceIDs', () => {
    it('should calculate the service id for a given object and defintion', () => {
      expect(
        createServiceIDs({
          entry: { a: 'A', b: 'B', c: 'C' },
          serviceIDFields: ['a', 'b'],
          typeID,
        }),
      ).toEqual({
        a: 'A',
        b: 'B',
        object_service_id: 'object_name,myAdapter.myType',
      })
    })
    it('should not crash on non-primitive service id values', () => {
      const entry = { a: { x: ['A', 'B'], b: 'B' } }
      expect(
        createServiceIDs({
          entry,
          serviceIDFields: ['a', 'b'],
          typeID,
        }),
      ).toEqual({
        ...entry,
        object_service_id: 'object_name,myAdapter.myType',
      })
    })
    it('should not crash on missing fields', () => {
      expect(
        createServiceIDs({
          entry: { a: 'A' },
          serviceIDFields: ['a', 'b'],
          typeID,
        }),
      ).toEqual({
        a: 'A',
        object_service_id: 'object_name,myAdapter.myType',
      })
    })
  })

  describe('serviceIDKeyCreator', () => {
    it('should create a stable serialization', () => {
      expect(serviceIDKeyCreator({ serviceIDFields: ['a', 'b'], typeID })({ a: 'A', c: 'C', b: 'B' })).toEqual(
        '{"a":"A","b":"B","object_service_id":"object_name,myAdapter.myType"}',
      )
      expect(serviceIDKeyCreator({ serviceIDFields: ['a', 'b'], typeID })({ b: 'B', a: 'A', c: 'C' })).toEqual(
        '{"a":"A","b":"B","object_service_id":"object_name,myAdapter.myType"}',
      )
      expect(serviceIDKeyCreator({ serviceIDFields: ['b', 'a'], typeID })({ b: 'B', a: 'A', c: 'C' })).toEqual(
        '{"a":"A","b":"B","object_service_id":"object_name,myAdapter.myType"}',
      )
    })
  })

  describe('createElemIDFunc', () => {
    it('should calculate a nacl-cased elem name for a given object and defintion', () => {
      expect(
        createElemIDFunc({
          elemIDDef: {
            parts: [{ fieldName: 'a' }],
          },
          typeID,
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual('A')
      const func2 = createElemIDFunc({
        elemIDDef: {
          parts: [
            { fieldName: 'a' },
            // isReference is not relevant here
            { fieldName: 'c', condition: val => val.d !== undefined, isReference: true },
          ],
          delimiter: '-',
        },
        typeID,
      })
      expect(func2({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' })).toEqual('A')
      expect(func2({ entry: { a: 'A', c: 'C', d: 123 }, defaultName: 'unnamed' })).toEqual('A_C@b')
      expect(func2({ entry: { a: 'A ', c: 'C', d: 123 }, defaultName: 'unnamed' })).toEqual('A__C@sb')
    })
    it('should call getElemIdFunc when service id fields are defined', () => {
      expect(
        createElemIDFunc({
          elemIDDef: {
            parts: [{ fieldName: 'a' }],
          },
          typeID,
          getElemIdFunc: () => new ElemID('a', 'b', 'instance', 'NAME'),
          serviceIDDef: ['a'],
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual('NAME')
    })
    it('should fallback to default name if constructed name is empty', () => {
      expect(
        createElemIDFunc({
          elemIDDef: {},
          typeID,
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual('unnamed')
      expect(
        createElemIDFunc({
          elemIDDef: { parts: [{ fieldName: 'nonexistent' }] },
          typeID,
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual('unnamed')
    })
    it('should avoid double nacl-case when extending parent', () => {
      const func = createElemIDFunc({
        elemIDDef: {
          parts: [{ fieldName: 'a' }],
          extendsParent: true,
        },
        typeID,
      })
      const parent = new InstanceElement('parent:b', new ObjectType({ elemID: typeID }))
      expect(func({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed', parent })).toEqual('parent_b__A@fuu')
      expect(func({ entry: { a: 'A A', b: 'B', c: 'C' }, defaultName: 'unnamed', parent })).toEqual(
        'parent_b__A_A@fuus',
      )
    })
    it('should set name to _config for singleton', () => {
      const func = createElemIDFunc({
        elemIDDef: {
          parts: [{ fieldName: 'a' }],
        },
        singleton: true,
        typeID,
      })
      expect(func({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' })).toEqual(ElemID.CONFIG_NAME)
    })
    it('should use custom function when provided', () => {
      const func = createElemIDFunc({
        elemIDDef: {
          parts: [{ fieldName: 'a' }, { custom: () => () => 'CUSTOM', fieldName: 'ignore' }],
        },
        typeID,
      })
      expect(func({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' })).toEqual('A_CUSTOM')
    })
  })
  describe('getElemPath', () => {
    it('should calculate a nacl-cased elem name for a given object and defintion', () => {
      expect(
        getElemPath({
          def: {
            pathParts: [{ parts: [{ fieldName: 'a' }] }],
          },
          typeID,
          elemIDCreator: createElemIDFunc({
            elemIDDef: {
              parts: [{ fieldName: 'a' }],
            },
            typeID,
          }),
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'myType', 'A'])
    })
    it('should set path to settings folder if singleton', () => {
      expect(
        getElemPath({
          def: {
            pathParts: [{ parts: [{ fieldName: 'a' }] }],
          },
          typeID,
          singleton: true,
          elemIDCreator: createElemIDFunc({
            elemIDDef: {
              parts: [{ fieldName: 'a' }],
            },
            typeID,
          }),
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'Settings', 'myType'])
    })
  })
})
