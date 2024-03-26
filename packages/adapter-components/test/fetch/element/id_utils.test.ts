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
  getNameMapping,
} from '../../../src/fetch/element/id_utils'

describe('id utils', () => {
  const typeID = new ElemID('myAdapter', 'myType')
  describe('createServiceIDs', () => {
    it('should calculate the service id for a given object and definition', () => {
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
    it('should calculate a nacl-cased elem name for a given object and definition', () => {
      expect(
        createElemIDFunc({
          elemIDDef: {
            parts: [{ fieldName: 'a' }],
          },
          typeID,
          customNameMappingFunctions: {},
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
        customNameMappingFunctions: {},
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
          customNameMappingFunctions: {},
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual('NAME')
    })
    it('should fallback to default name if constructed name is empty', () => {
      expect(
        createElemIDFunc({
          elemIDDef: {},
          typeID,
          customNameMappingFunctions: {},
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual('unnamed')
      expect(
        createElemIDFunc({
          elemIDDef: { parts: [{ fieldName: 'nonexistent' }] },
          typeID,
          customNameMappingFunctions: {},
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
        customNameMappingFunctions: {},
      })
      const parent = new InstanceElement('parent:b', new ObjectType({ elemID: typeID }))
      expect(func({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed', parent })).toEqual('parent_b__A@fuu')
      expect(func({ entry: { a: 'A A', b: 'B', c: 'C' }, defaultName: 'unnamed', parent })).toEqual(
        'parent_b__A_A@fuus',
      )
    })
    it('should avoid extra delimiter when extending parent and no parts', () => {
      const func = createElemIDFunc({
        elemIDDef: {
          extendsParent: true,
        },
        typeID,
        customNameMappingFunctions: {},
      })
      const parent = new InstanceElement('parent:b', new ObjectType({ elemID: typeID }))
      expect(func({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed', parent })).toEqual('parent_b@f')
    })
    it('should set name to _config for singleton', () => {
      const func = createElemIDFunc({
        elemIDDef: {
          parts: [{ fieldName: 'a' }],
        },
        singleton: true,
        typeID,
        customNameMappingFunctions: {},
      })
      expect(func({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' })).toEqual(ElemID.CONFIG_NAME)
    })
    it('should use custom function when provided', () => {
      const func = createElemIDFunc({
        elemIDDef: {
          parts: [{ fieldName: 'a' }, { custom: () => () => 'CUSTOM', fieldName: 'ignore' }],
        },
        typeID,
        customNameMappingFunctions: {},
      })
      expect(func({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' })).toEqual('A_CUSTOM')
    })
  })

  describe('getElemPath', () => {
    it('should calculate a nacl-cased elem name for a given object and definition', () => {
      expect(
        getElemPath({
          def: {
            pathParts: [
              {
                parts: [{ fieldName: 'a', mapping: 'customTest' }],
              },
            ],
          },
          typeID,
          elemIDCreator: createElemIDFunc({
            elemIDDef: {
              parts: [{ fieldName: 'a' }],
            },
            typeID,
            customNameMappingFunctions: {},
          }),
          customNameMappingFunctions: {
            customTest: () => 'thisIsACuteCustomName',
          },
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'myType', 'thisIsACuteCustomName'])
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
            customNameMappingFunctions: {},
          }),
          customNameMappingFunctions: {},
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'Settings', 'myType'])
    })
    it('it should create self folder if createSelfFolder is true', () => {
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
          createSelfFolder: true,
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'myType', 'A', 'A'])
    })
    it('it should nest under path if nested path provided and ignore the curent instance type name', () => {
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
          nestUnderPath: ['ParentType', 'FieldName'],
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'ParentType', 'FieldName', 'A'])
    })
    it('it should work with both nestUnderPath and createSelfFolder', () => {
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
          nestUnderPath: ['ParentType', 'FieldName'],
          createSelfFolder: true,
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'ParentType', 'FieldName', 'A', 'A'])
    })
  })

  describe('getNameMapping', () => {
    describe('when mapping is not defined', () => {
      it('should return the name as is', () => {
        expect(
          getNameMapping({
            name: 'name',
            nameMapping: undefined,
            customNameMappingFunctions: {},
          }),
        ).toEqual('name')
      })
    })

    describe('when mapping is defined', () => {
      describe('when mapping is lowercase', () => {
        it('should return the name in lowercase', () => {
          expect(
            getNameMapping({
              name: 'NAME',
              nameMapping: 'lowercase',
              customNameMappingFunctions: {},
            }),
          ).toEqual('name')
        })
      })

      describe('when mapping is uppercase', () => {
        it('should return the name in uppercase', () => {
          expect(
            getNameMapping({
              name: 'name',
              nameMapping: 'uppercase',
              customNameMappingFunctions: {},
            }),
          ).toEqual('NAME')
        })
      })

      describe('when mapping is a custom function', () => {
        it('should return the name after applying the custom function', () => {
          expect(
            getNameMapping({
              name: 'name',
              nameMapping: 'test',
              customNameMappingFunctions: {
                test: () => 'test',
              },
            }),
          ).toEqual('test')
        })
      })
    })
  })
})
