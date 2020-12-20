/*
*                      Copyright 2020 Salto Labs Ltd.
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

import {
  getDeepInnerType,
  // getField, getFieldType
} from '../src/utils'
import { ObjectType, ListType, isElement, isField, isListType, isMapType, MapType } from '../src/elements'
import { ElemID } from '../src/element_id'
import { BuiltinTypes } from '../src/builtins'
import { ReferenceExpression } from '../src/values'

describe('Test utils.ts & isXXX in elements.ts', () => {
  const mockElemID = new ElemID('test-utils', 'obj')
  const listOfNum = new ListType(BuiltinTypes.NUMBER)
  const mapOfNum = new MapType(BuiltinTypes.NUMBER)
  const mapOfMapOfNum = new MapType(new MapType(BuiltinTypes.NUMBER))
  const listOfListofNum = new ListType(new ListType(BuiltinTypes.NUMBER))
  const mapOfListOfNum = new MapType(new ListType(BuiltinTypes.NUMBER))
  const listOfMapOfNum = new ListType(new MapType(BuiltinTypes.NUMBER))
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
    },
    annotationRefsOrTypes: {},
    annotations: {},
  })
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
    it('should return true for primitive field type', () => {
      expect(isElement(mockObjectType.fields.fieldTest.getType())).toBeTruthy()
    })
    it('should return true for list field type', () => {
      expect(isElement(mockObjectType.fields.listFieldTest.getType())).toBeTruthy()
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
    it('should recognize lists as ListType', () => {
      expect(isListType(mockObjectType.fields.listFieldTest.getType())).toBeTruthy()
      expect(isListType(mockObjectType.fields.listOfListFieldTest.getType())).toBeTruthy()
      const mapOfListType = mockObjectType.fields.mapOfListFieldTest.getType() as MapType
      expect(isListType(mapOfListType.getInnerType())).toBeTruthy()
    })

    it('should return false for non-list types', () => {
      expect(isListType(mockObjectType.fields.fieldTest.getType())).toBeFalsy()
      expect(isListType(mockObjectType.fields.mapOfMapFieldTest.getType())).toBeFalsy()
    })
  })

  describe('isMapType func', () => {
    it('should recognize maps as MapType', () => {
      expect(isMapType(mockObjectType.fields.mapFieldTest.getType())).toBeTruthy()
      expect(isMapType(mockObjectType.fields.mapOfMapFieldTest.getType())).toBeTruthy()
      expect(isMapType(mockObjectType.fields.mapOfListFieldTest.getType())).toBeTruthy()
      const listOfMapType = mockObjectType.fields.listOfMapFieldTest.getType() as ListType
      expect(isMapType(listOfMapType.getInnerType())).toBeTruthy()
    })

    it('should return false for non-map types', () => {
      expect(isMapType(mockObjectType.fields.fieldTest.getType())).toBeFalsy()
    })
  })

  describe('getDeepInnerType func', () => {
    it('should recognize getDeepInnerType in a list', () => {
      expect(getDeepInnerType(mockObjectType.fields.listFieldTest.getType() as ListType))
        .toEqual(BuiltinTypes.NUMBER)
    })
    it('should recognize getDeepInnerType in list of lists', () => {
      expect(getDeepInnerType(mockObjectType.fields.listOfListFieldTest.getType() as ListType))
        .toEqual(BuiltinTypes.NUMBER)
    })
    it('should recognize getDeepInnerType in a map', () => {
      expect(getDeepInnerType(mockObjectType.fields.mapFieldTest.getType() as MapType))
        .toEqual(BuiltinTypes.NUMBER)
    })
    it('should recognize getDeepInnerType in map of maps', () => {
      expect(getDeepInnerType(mockObjectType.fields.mapOfMapFieldTest.getType() as MapType))
        .toEqual(BuiltinTypes.NUMBER)
    })
    it('should recognize getDeepInnerType in map of lists', () => {
      expect(getDeepInnerType(mockObjectType.fields.mapOfListFieldTest.getType() as MapType))
        .toEqual(BuiltinTypes.NUMBER)
    })
    it('should recognize getDeepInnerType in list of maps', () => {
      expect(getDeepInnerType(mockObjectType.fields.listOfMapFieldTest.getType() as ListType))
        .toEqual(BuiltinTypes.NUMBER)
    })
  })
/*
describe('getField, getFieldType funcs', () => {
it('should succeed on a standard field', () => {
expect(getField(mockObjectType, ['fieldTest'])).toEqual(mockObjectType.fields.fieldTest)
expect(getFieldType(mockObjectType, ['fieldTest'])).toEqual(BuiltinTypes.NUMBER)
})

it('should succeed on a list field', () => {
expect(getField(mockObjectType, ['listFieldTest'])).toEqual(mockObjectType.fields.listFieldTest)
expect(getFieldType(mockObjectType, ['listFieldTest'])).toEqual(new ListType(BuiltinTypes.NUMBER))
expect(getField(mockObjectType, ['listOfListFieldTest']))
.toEqual(mockObjectType.fields.listOfListFieldTest)
expect(getFieldType(mockObjectType, ['listOfListFieldTest']))
.toEqual(new ListType(new ListType(BuiltinTypes.NUMBER)))
})

it('should succeed on a map field', () => {
expect(getField(mockObjectType, ['mapFieldTest'])).toEqual(mockObjectType.fields.mapFieldTest)
expect(getFieldType(mockObjectType, ['mapFieldTest'])).toEqual(new MapType(BuiltinTypes.NUMBER))
expect(getField(mockObjectType, ['mapOfMapFieldTest']))
.toEqual(mockObjectType.fields.mapOfMapFieldTest)
expect(getFieldType(mockObjectType, ['mapOfMapFieldTest']))
.toEqual(new MapType(new MapType(BuiltinTypes.NUMBER)))
})

it('should return undefined on a nonexistent field', () => {
expect(getField(mockObjectType, ['nonExistentField'])).toBeUndefined()
expect(getFieldType(mockObjectType, ['nonExistentField'])).toBeUndefined()
})
})
*/
})
