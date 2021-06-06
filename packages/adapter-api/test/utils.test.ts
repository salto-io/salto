/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import { getDeepInnerType, getField, getFieldType } from '../src/utils'
import { ObjectType, ListType, isElement, isField, isListType, isMapType, MapType, PrimitiveType, PrimitiveTypes, ReadOnlyElementsSource } from '../src/elements'
import { ElemID } from '../src/element_id'
import { BuiltinTypes } from '../src/builtins'
import { ReferenceExpression } from '../src/values'

const { awu } = collections.asynciterable

describe('Test utils.ts & isXXX in elements.ts', () => {
  const mockElemID = new ElemID('test-utils', 'obj')
  const listOfNum = new ListType(BuiltinTypes.NUMBER)
  const mapOfNum = new MapType(BuiltinTypes.NUMBER)
  const mapOfMapOfNum = new MapType(new MapType(BuiltinTypes.NUMBER))
  const listOfListofNum = new ListType(new ListType(BuiltinTypes.NUMBER))
  const mapOfListOfNum = new MapType(new ListType(BuiltinTypes.NUMBER))
  const listOfMapOfNum = new ListType(new MapType(BuiltinTypes.NUMBER))
  const primElemID = new ElemID('ad', 'prim')
  const primitiveNum = new PrimitiveType({
    elemID: primElemID,
    primitive: PrimitiveTypes.NUMBER,
  })
  const mapOfPrimitiveNum = new MapType(primitiveNum)
  const mapOfMapOfPrimitiveNum = new MapType(new MapType(primitiveNum))
  const mockObjectType = new ObjectType({
    elemID: mockElemID,
    fields: {
      fieldTest: {
        refType: new ReferenceExpression(BuiltinTypes.NUMBER.elemID, BuiltinTypes.NUMBER),
      },
      listFieldTest: {
        refType: new ReferenceExpression(listOfNum.elemID, listOfNum),
      },
      mapFieldTest: {
        refType: new ReferenceExpression(mapOfNum.elemID, mapOfNum),
      },
      listOfListFieldTest: {
        refType: new ReferenceExpression(listOfListofNum.elemID, listOfListofNum),
      },
      mapOfMapFieldTest: {
        refType: new ReferenceExpression(mapOfMapOfNum.elemID, mapOfMapOfNum),
      },
      mapOfListFieldTest: {
        refType: new ReferenceExpression(mapOfListOfNum.elemID, mapOfListOfNum),
      },
      listOfMapFieldTest: {
        refType: new ReferenceExpression(listOfMapOfNum.elemID, listOfMapOfNum),
      },
      mapOfPrimitive: {
        refType: new ReferenceExpression(mapOfPrimitiveNum.elemID, mapOfPrimitiveNum),
      },
    },
    annotationRefsOrTypes: {},
    annotations: {},
  })
  const mockList = new ListType(BuiltinTypes.NUMBER)
  const mockMap = new MapType(BuiltinTypes.NUMBER)
  const mockListList = new ListType(mockList)
  const mockMapMap = new MapType(mockMap)
  const srcElements = [
    mockObjectType,
    mapOfPrimitiveNum,
    BuiltinTypes.NUMBER,
    mockList,
    mockMap,
    mockListList,
    mockMapMap,
  ]
  const elmSource: ReadOnlyElementsSource = {
    get: async elemID => srcElements.find(e => e.elemID.isEqual(elemID)),
    getAll: async () => awu(srcElements),
    has: async elemID => srcElements.find(e => e.elemID.isEqual(elemID)) !== undefined,
    list: async () => awu(srcElements).map(e => e.elemID),
  }
  describe('isElement func', () => {
    it('should return false for undefined', () => {
      expect(isElement(undefined)).toBeFalsy()
    })
    it('should return true for objectType', () => {
      expect(isElement(mockObjectType)).toBeTruthy()
    })
    it('should return true for field', () => {
      expect(isElement(mockObjectType.fields.fieldTest)).toBeTruthy()
    })
    it('should return true for primitive field type', async () => {
      expect(isElement(await mockObjectType.fields.fieldTest.getType())).toBeTruthy()
    })
    it('should return true for list field type', async () => {
      expect(isElement(await mockObjectType.fields.listFieldTest.getType())).toBeTruthy()
    })
  })
  describe('isField func', () => {
    it('should return false for undefined', () => {
      expect(isField(undefined)).toBeFalsy()
    })
    it('should return false for string', () => {
      expect(isField('str')).toBeFalsy()
    })

    it('should return false for object', () => {
      expect(isField(mockObjectType)).toBeFalsy()
    })

    it('should return true for fields', () => {
      expect(isField(mockObjectType.fields.fieldTest)).toBeTruthy()
      expect(isField(mockObjectType.fields.listFieldTest)).toBeTruthy()
      expect(isField(mockObjectType.fields.listOfListFieldTest)).toBeTruthy()
    })
  })

  describe('isListType func', () => {
    it('should recognize lists as ListType', async () => {
      expect(isListType(await mockObjectType.fields.listFieldTest.getType())).toBeTruthy()
      expect(isListType(await mockObjectType.fields.listOfListFieldTest.getType())).toBeTruthy()
      const mapOfListType = await mockObjectType.fields.mapOfListFieldTest.getType() as MapType
      expect(isListType(await mapOfListType.getInnerType())).toBeTruthy()
    })

    it('should return false for non-list types', async () => {
      expect(isListType(await mockObjectType.fields.fieldTest.getType())).toBeFalsy()
      expect(isListType(await mockObjectType.fields.mapOfMapFieldTest.getType())).toBeFalsy()
    })
  })

  describe('isMapType func', () => {
    it('should recognize maps as MapType', async () => {
      expect(isMapType(await mockObjectType.fields.mapFieldTest.getType())).toBeTruthy()
      expect(isMapType(await mockObjectType.fields.mapOfMapFieldTest.getType())).toBeTruthy()
      expect(isMapType(await mockObjectType.fields.mapOfListFieldTest.getType())).toBeTruthy()
      const listOfMapType = await mockObjectType.fields.listOfMapFieldTest.getType() as ListType
      expect(isMapType(await listOfMapType.getInnerType())).toBeTruthy()
    })

    it('should return false for non-map types', async () => {
      expect(isMapType(await mockObjectType.fields.fieldTest.getType())).toBeFalsy()
    })
  })

  describe('getDeepInnerType func', () => {
    it('should recognize getDeepInnerType in a list', async () => {
      expect(await getDeepInnerType(
        await mockObjectType.fields.listFieldTest.getType() as ListType
      )).toEqual(BuiltinTypes.NUMBER)
    })
    it('should recognize getDeepInnerType in list of lists', async () => {
      expect(await getDeepInnerType(
        await mockObjectType.fields.listOfListFieldTest.getType() as ListType
      )).toEqual(BuiltinTypes.NUMBER)
    })
    it('should recognize getDeepInnerType in a map', async () => {
      expect(await getDeepInnerType(await mockObjectType.fields.mapFieldTest.getType() as MapType))
        .toEqual(BuiltinTypes.NUMBER)
    })

    it('should recognize getDeepInnerType in a map with ElementsSource', async () => {
      expect(await getDeepInnerType(mapOfPrimitiveNum))
        .toEqual(primitiveNum)
    })

    it('should recognize getDeepInnerType in a map of map with ElementsSource', async () => {
      expect(await getDeepInnerType(mapOfMapOfPrimitiveNum))
        .toEqual(primitiveNum)
    })

    it('should recognize getDeepInnerType in map of maps', async () => {
      expect(await getDeepInnerType(
        await mockObjectType.fields.mapOfMapFieldTest.getType() as MapType
      )).toEqual(BuiltinTypes.NUMBER)
    })
    it('should recognize getDeepInnerType in map of lists', async () => {
      expect(await getDeepInnerType(
        await mockObjectType.fields.mapOfListFieldTest.getType() as MapType
      )).toEqual(BuiltinTypes.NUMBER)
    })
    it('should recognize getDeepInnerType in list of maps', async () => {
      expect(await getDeepInnerType(
        await mockObjectType.fields.listOfMapFieldTest.getType() as ListType
      )).toEqual(BuiltinTypes.NUMBER)
    })
    it('should return the type if not container', async () => {
      expect(await getDeepInnerType(primitiveNum)).toEqual(primitiveNum)
    })
  })
  describe('getField, getFieldType funcs', () => {
    describe('With ElementsSource', () => {
      it('should succeed on a standard field', async () => {
        expect(await getField(mockObjectType, ['fieldTest'], elmSource)).toEqual(mockObjectType.fields.fieldTest)
        expect(await getFieldType(mockObjectType, ['fieldTest'], elmSource)).toEqual(BuiltinTypes.NUMBER)
      })

      it('should succeed on a list field', async () => {
        expect(await getField(mockObjectType, ['listFieldTest'], elmSource)).toEqual(mockObjectType.fields.listFieldTest)
        expect(await getFieldType(mockObjectType, ['listFieldTest'], elmSource)).toEqual(new ListType(BuiltinTypes.NUMBER))
        expect(await getField(mockObjectType, ['listOfListFieldTest'], elmSource))
          .toEqual(mockObjectType.fields.listOfListFieldTest)
        expect(await getFieldType(mockObjectType, ['listOfListFieldTest'], elmSource))
          .toEqual(new ListType(new ListType(BuiltinTypes.NUMBER)))
      })

      it('should succeed on a map field', async () => {
        expect(await getField(mockObjectType, ['mapFieldTest'], elmSource)).toEqual(mockObjectType.fields.mapFieldTest)
        expect(await getFieldType(mockObjectType, ['mapFieldTest'], elmSource)).toEqual(new MapType(BuiltinTypes.NUMBER))
        expect(await getField(mockObjectType, ['mapOfMapFieldTest'], elmSource))
          .toEqual(mockObjectType.fields.mapOfMapFieldTest)
        expect(await getFieldType(mockObjectType, ['mapOfMapFieldTest'], elmSource))
          .toEqual(new MapType(new MapType(BuiltinTypes.NUMBER)))
        expect(await getField(mockObjectType, ['mapOfPrimitive'], elmSource)).toEqual(mockObjectType.fields.mapOfPrimitive)
        expect(await getFieldType(mockObjectType, ['mapOfPrimitive'], elmSource)).toEqual(mapOfPrimitiveNum)
      })

      it('should return undefined on a nonexistent field', async () => {
        expect(await getField(mockObjectType, ['nonExistentField'], elmSource)).toBeUndefined()
        expect(await getFieldType(mockObjectType, ['nonExistentField'], elmSource)).toBeUndefined()
      })
    })

    describe('Without ElementsSource', () => {
      it('should succeed on a standard field', async () => {
        expect(await getField(mockObjectType, ['fieldTest'])).toEqual(mockObjectType.fields.fieldTest)
        expect(await getFieldType(mockObjectType, ['fieldTest'])).toEqual(BuiltinTypes.NUMBER)
      })

      it('should succeed on a list field', async () => {
        expect(await getField(mockObjectType, ['listFieldTest'])).toEqual(mockObjectType.fields.listFieldTest)
        expect(await getFieldType(mockObjectType, ['listFieldTest'])).toEqual(new ListType(BuiltinTypes.NUMBER))
        expect(await getField(mockObjectType, ['listOfListFieldTest']))
          .toEqual(mockObjectType.fields.listOfListFieldTest)
        expect(await getFieldType(mockObjectType, ['listOfListFieldTest']))
          .toEqual(new ListType(new ListType(BuiltinTypes.NUMBER)))
      })

      it('should succeed on a map field', async () => {
        expect(await getField(mockObjectType, ['mapFieldTest'])).toEqual(mockObjectType.fields.mapFieldTest)
        expect(await getFieldType(mockObjectType, ['mapFieldTest'])).toEqual(new MapType(BuiltinTypes.NUMBER))
        expect(await getField(mockObjectType, ['mapOfMapFieldTest']))
          .toEqual(mockObjectType.fields.mapOfMapFieldTest)
        expect(await getFieldType(mockObjectType, ['mapOfMapFieldTest']))
          .toEqual(new MapType(new MapType(BuiltinTypes.NUMBER)))
      })

      it('should return undefined on a nonexistent field', async () => {
        expect(await getField(mockObjectType, ['nonExistentField'])).toBeUndefined()
        expect(await getFieldType(mockObjectType, ['nonExistentField'])).toBeUndefined()
      })
    })
  })
})
