/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { FieldDefinition, BuiltinTypes, ObjectType, ElemID, createRefToElmWithValue, Value, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { SUBTYPES_PATH, TYPES_PATH } from '../../src/elements/constants'
import { filterTypes, getContainerForType, hideFields, markServiceIdField } from '../../src/elements/type_elements'

describe('type_elements', () => {
  describe('hideFields', () => {
    let myParentCustomType: ObjectType
    let myCustomType: ObjectType

    beforeEach(() => {
      myCustomType = new ObjectType({
        elemID: new ElemID('adapter', 'myCustomType'),
        fields: {
          str: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.REQUIRED]: true } },
          num: { refType: BuiltinTypes.NUMBER },
        },
      })
      myParentCustomType = new ObjectType({
        elemID: new ElemID('adapter', 'myParentCustomType'),
        fields: {
          str: { refType: BuiltinTypes.STRING },
          num: { refType: BuiltinTypes.NUMBER },
          custom: { refType: myCustomType },
        },
      })
    })
    it('should hide values for fields matching the specification', () => {
      hideFields([
        { fieldName: 'str', fieldType: 'string' },
      ], myCustomType)
      // eslint-disable-next-line no-underscore-dangle
      expect(myCustomType.fields.str.annotations._hidden_value).toBeTruthy()
      expect(myCustomType.fields.num.annotations).toEqual({})

      hideFields([
        { fieldName: 'num' },
        { fieldName: 'custom', fieldType: 'myCustomType' },
      ], myParentCustomType)
      // eslint-disable-next-line no-underscore-dangle
      expect(myParentCustomType.fields.num.annotations?._hidden_value).toBeTruthy()
      // eslint-disable-next-line no-underscore-dangle
      expect(myParentCustomType.fields.custom.annotations?._hidden_value).toBeTruthy()
      expect(myParentCustomType.fields.str.annotations).toEqual({})
    })
    it('should not hide values for fields that do not have the right type', () => {
      hideFields([
        { fieldName: 'str', fieldType: 'something' },
      ], myCustomType)
      expect(myCustomType.fields.str.annotations).toEqual({ [CORE_ANNOTATIONS.REQUIRED]: true })
      expect(myCustomType.fields.num.annotations).toEqual({})

      hideFields([
        { fieldName: 'num', fieldType: 'string' },
        { fieldName: 'custom', fieldType: 'number' },
      ], myParentCustomType)
      expect(myParentCustomType.fields.str.annotations).toEqual({})
      expect(myParentCustomType.fields.num.annotations).toEqual({})
      expect(myParentCustomType.fields.custom.annotations).toEqual({})
    })
    it('should add fields that are not found', () => {
      hideFields([
        { fieldName: 'missing' },
      ], myCustomType)
      expect(Object.keys(myCustomType.fields)).toHaveLength(3)
      expect(myCustomType.fields.str.annotations).toEqual({ [CORE_ANNOTATIONS.REQUIRED]: true })
      expect(myCustomType.fields.num.annotations).toEqual({})
      // eslint-disable-next-line no-underscore-dangle
      expect(myCustomType.fields.missing.annotations._hidden_value).toBeTruthy()
      expect(myCustomType.fields.missing.refType.elemID.name).toEqual('unknown')


      hideFields([
        { fieldName: 'missing' },
      ], myParentCustomType)
      expect(Object.keys(myParentCustomType.fields)).toHaveLength(4)
      expect(myParentCustomType.fields.str.annotations).toEqual({})
      expect(myParentCustomType.fields.num.annotations).toEqual({})
      expect(myParentCustomType.fields.custom.annotations).toEqual({})
      // eslint-disable-next-line no-underscore-dangle
      expect(myParentCustomType.fields.missing.annotations._hidden_value).toBeTruthy()
      expect(myCustomType.fields.missing.refType.elemID.name).toEqual('unknown')
    })
    it('should not add specific type fields that are not found', () => {
      hideFields([
        { fieldName: 'missing', fieldType: 'string' },
      ], myCustomType)
      expect(Object.keys(myCustomType.fields)).toHaveLength(2)
      expect(myCustomType.fields.str.annotations).toEqual({ [CORE_ANNOTATIONS.REQUIRED]: true })
      expect(myCustomType.fields.num.annotations).toEqual({})

      hideFields([
        { fieldName: 'missing', fieldType: 'string' },
      ], myParentCustomType)
      expect(Object.keys(myParentCustomType.fields)).toHaveLength(3)
      expect(myParentCustomType.fields.str.annotations).toEqual({})
      expect(myParentCustomType.fields.num.annotations).toEqual({})
      expect(myParentCustomType.fields.custom.annotations).toEqual({})
    })
    it('should add build-in object names as fields', () => {
      hideFields([
        { fieldName: 'toString' },
      ], myCustomType)
      expect(Object.keys(myCustomType.fields)).toHaveLength(3)
      expect(myCustomType.fields.str.annotations).toEqual({ [CORE_ANNOTATIONS.REQUIRED]: true })
      expect(myCustomType.fields.num.annotations).toEqual({})
      // to avoid transpilation errors
      const toStringField: Value = myCustomType.fields.toString
      // eslint-disable-next-line no-underscore-dangle
      expect(toStringField.annotations._hidden_value).toBeTruthy()
    })
  })

  describe('filterTypes', () => {
    it('should filter the right types', async () => {
      const typeA = new ObjectType({ elemID: new ElemID('adapterName', 'A') })
      const typeB = new ObjectType({ elemID: new ElemID('adapterName', 'B'), path: ['adapter', 'somePath'] })
      const typeC = new ObjectType({ elemID: new ElemID('adapterName', 'C'),
        fields: {
          a: { refType: typeA },
          b: { refType: typeB },
        } })
      const typeD = new ObjectType({ elemID: new ElemID('adapterName', 'D') })
      const filteredTypes = await filterTypes('adapterName', [typeA, typeC, typeD], ['C', 'E'])

      expect(filteredTypes[0].elemID.getFullNameParts()).toEqual(['adapterName', 'C'])
      expect(filteredTypes[0].path).toEqual(['adapterName', TYPES_PATH, 'C'])
      expect(filteredTypes[1].elemID.getFullNameParts()).toEqual(['adapterName', 'A'])
      expect(filteredTypes[1].path).toEqual(['adapterName', TYPES_PATH, SUBTYPES_PATH, 'A'])
      expect(filteredTypes[2].elemID.getFullNameParts()).toEqual(['adapterName', 'B'])
      expect(filteredTypes[2].path).toEqual(['adapter', 'somePath'])
    })
  })

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
})
