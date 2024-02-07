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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FieldDefinition, BuiltinTypes, ObjectType, ElemID, createRefToElmWithValue } from '@salto-io/adapter-api'
import { markServiceIdField, getContainerForType, toNestedTypeName, toPrimitiveType } from '../../../src/fetch/element/type_utils'

describe('type utils', () => {
  describe('markServiceIdField', () => {
    describe('mark service id correctly', () => {
      it('should mark string', () => {
        const typeFields = {
          id: { refType: BuiltinTypes.STRING },
          anotherField: { refType: BuiltinTypes.STRING },
        }
        markServiceIdField('id', typeFields, 'test')
        expect(typeFields.id.refType).toEqual(
          createRefToElmWithValue(BuiltinTypes.SERVICE_ID)
        )
      })
      it('should mark number', () => {
        const typeFields = {
          id: { refType: BuiltinTypes.NUMBER },
          anotherField: { refType: BuiltinTypes.STRING },
        }
        markServiceIdField('id', typeFields, 'test')
        expect(typeFields.id.refType).toEqual(
          createRefToElmWithValue(BuiltinTypes.SERVICE_ID_NUMBER)
        )
      })
      it('should not mark boolean', () => {
        const typeFields = {
          id: { refType: BuiltinTypes.BOOLEAN },
          anotherField: { refType: BuiltinTypes.STRING },
        }
        markServiceIdField('id', typeFields, 'test')
        expect(typeFields.id.refType).toEqual(BuiltinTypes.BOOLEAN)
      })
      it('should not mark non primitive types', () => {
        const type = new ObjectType({ elemID: new ElemID('adapter', 'test') })
        const typeFields = {
          id: { refType: type },
          anotherField: { refType: BuiltinTypes.STRING },
        }
        markServiceIdField('id', typeFields, 'test')
        expect(typeFields.id.refType).toEqual(type)
      })
      it('should not mark non existent field', () => {
        const typeFields: Record<string, FieldDefinition> = {
          anotherField: { refType: BuiltinTypes.STRING },
        }
        markServiceIdField('id', typeFields, 'test')
        expect(typeFields.id).not.toBeDefined()
      })
    })
  })

  describe('getContainerForType', () => {
    it('should return the correct container and type name substring', () => {
      const listType = getContainerForType('list<SomeType>')
      expect(listType?.container).toEqual('list')
      expect(listType?.typeNameSubstring).toEqual('SomeType')
      const mapType = getContainerForType('map<list<AnotherType>>')
      expect(mapType?.container).toEqual('map')
      expect(mapType?.typeNameSubstring).toEqual('list<AnotherType>')
    })
    it('should return undefined if there is no container', () => {
      const result = getContainerForType('SomeType')
      expect(result).toBeUndefined()
    })
  })

  describe('toNestedTypeName', () => {
    it('should concatenate the parent and child types', () => {
      expect(toNestedTypeName('aaa', 'bbb')).toEqual('aaa__bbb')
    })
  })

  describe('toPrimitiveType', () => {
    it('should return the right primitive type when one is specified', () => {
      expect(toPrimitiveType('string')).toEqual(BuiltinTypes.STRING)
      expect(toPrimitiveType('boolean')).toEqual(BuiltinTypes.BOOLEAN)
      expect(toPrimitiveType('number')).toEqual(BuiltinTypes.NUMBER)
    })
    it('should return unknown when type is not known', () => {
      expect(toPrimitiveType('bla')).toEqual(BuiltinTypes.UNKNOWN)
    })
  })
})
