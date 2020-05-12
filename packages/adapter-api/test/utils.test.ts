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
} from '../src/utils'
import {
  ObjectType, ListType, isElement, isField, isListType,
} from '../src/elements'
import {
  ElemID,
} from '../src/element_id'
import {
  BuiltinTypes,
} from '../src/builtins'

describe('Test utils.ts & isXXX in elements.ts', () => {
  const mockElemID = new ElemID('test-utils', 'obj')
  const mockObjectType = new ObjectType({
    elemID: mockElemID,
    fields: [
      { name: 'fieldTest', type: BuiltinTypes.NUMBER },
      { name: 'listFieldTest', type: new ListType(BuiltinTypes.NUMBER) },
      { name: 'listOfListFieldTest', type: new ListType(new ListType(BuiltinTypes.NUMBER)) },
    ],
    annotationTypes: {},
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
      expect(isElement(mockObjectType.fields.fieldTest.type)).toBeTruthy()
    })
    it('should return true for list field type', () => {
      expect(isElement(mockObjectType.fields.listFieldTest.type)).toBeTruthy()
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
      expect(isListType(mockObjectType.fields.listFieldTest.type)).toBeTruthy()
      expect(isListType(mockObjectType.fields.listOfListFieldTest.type)).toBeTruthy()
    })

    it('should return false for non-list types', () => {
      expect(isListType(mockObjectType.fields.fieldTest.type)).toBeFalsy()
    })
  })

  describe('getDeepInnerType func', () => {
    it('should recognize getDeepInnerType in a list', () => {
      expect(getDeepInnerType(mockObjectType.fields.listFieldTest.type as ListType))
        .toEqual(BuiltinTypes.NUMBER)
    })
    it('should recognize getDeepInnerType in list of lists', () => {
      expect(getDeepInnerType(mockObjectType.fields.listOfListFieldTest.type as ListType))
        .toEqual(BuiltinTypes.NUMBER)
    })
  })
})
