/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getDeepInnerType, getField, getFieldType } from '../src/utils'
import {
  ObjectType,
  ListType,
  isElement,
  isField,
  isListType,
  isMapType,
  MapType,
  PrimitiveType,
  PrimitiveTypes,
} from '../src/elements'
import { ElemID } from '../src/element_id'
import { BuiltinTypes } from '../src/builtins'
import { isSaltoElementError } from '../src/error'

describe('Test utils.ts & isXXX in elements.ts', () => {
  const innerType = new ObjectType({
    elemID: new ElemID('test-utils', 'innerObj'),
    fields: {
      innerField: { refType: BuiltinTypes.STRING },
    },
  })
  const mockObjectType = new ObjectType({
    elemID: new ElemID('test-utils', 'obj'),
    fields: {
      fieldTest: { refType: BuiltinTypes.NUMBER },
      listFieldTest: { refType: new ListType(BuiltinTypes.NUMBER) },
      mapFieldTest: { refType: new MapType(BuiltinTypes.NUMBER) },
      listOfListFieldTest: { refType: new ListType(new ListType(BuiltinTypes.NUMBER)) },
      mapOfMapFieldTest: { refType: new MapType(new MapType(BuiltinTypes.NUMBER)) },
      mapOfListFieldTest: { refType: new MapType(new ListType(BuiltinTypes.NUMBER)) },
      listOfMapFieldTest: { refType: new ListType(new MapType(BuiltinTypes.NUMBER)) },
      innerTypeFieldTest: { refType: innerType },
      listOfInnerTypeFieldTest: { refType: new ListType(innerType) },
    },
    annotationRefsOrTypes: { someAnno: innerType },
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
      const mapOfListType = (await mockObjectType.fields.mapOfListFieldTest.getType()) as MapType
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
      const listOfMapType = (await mockObjectType.fields.listOfMapFieldTest.getType()) as ListType
      expect(isMapType(await listOfMapType.getInnerType())).toBeTruthy()
    })

    it('should return false for non-map types', async () => {
      expect(isMapType(await mockObjectType.fields.fieldTest.getType())).toBeFalsy()
    })
  })

  describe('getDeepInnerType func', () => {
    it('should recognize getDeepInnerType in a list', async () => {
      expect(await getDeepInnerType((await mockObjectType.fields.listFieldTest.getType()) as ListType)).toEqual(
        BuiltinTypes.NUMBER,
      )
    })
    it('should recognize getDeepInnerType in list of lists', async () => {
      expect(await getDeepInnerType((await mockObjectType.fields.listOfListFieldTest.getType()) as ListType)).toEqual(
        BuiltinTypes.NUMBER,
      )
    })
    it('should recognize getDeepInnerType in a map', async () => {
      expect(await getDeepInnerType((await mockObjectType.fields.mapFieldTest.getType()) as MapType)).toEqual(
        BuiltinTypes.NUMBER,
      )
    })
    it('should recognize getDeepInnerType in map of maps', async () => {
      expect(await getDeepInnerType((await mockObjectType.fields.mapOfMapFieldTest.getType()) as MapType)).toEqual(
        BuiltinTypes.NUMBER,
      )
    })
    it('should recognize getDeepInnerType in map of lists', async () => {
      expect(await getDeepInnerType((await mockObjectType.fields.mapOfListFieldTest.getType()) as MapType)).toEqual(
        BuiltinTypes.NUMBER,
      )
    })
    it('should recognize getDeepInnerType in list of maps', async () => {
      expect(await getDeepInnerType((await mockObjectType.fields.listOfMapFieldTest.getType()) as ListType)).toEqual(
        BuiltinTypes.NUMBER,
      )
    })
    it('should return the type if not container', async () => {
      const primitiveNum = new PrimitiveType({
        elemID: new ElemID('ad', 'prim'),
        primitive: PrimitiveTypes.NUMBER,
      })
      expect(await getDeepInnerType(primitiveNum)).toEqual(primitiveNum)
    })
  })
  describe('getField', () => {
    it('should succeed on a standard field', async () => {
      expect(await getField(mockObjectType, ['fieldTest'])).toEqual(mockObjectType.fields.fieldTest)
    })
    it('should succeed on a list field', async () => {
      expect(await getField(mockObjectType, ['listFieldTest'])).toEqual(mockObjectType.fields.listFieldTest)
      expect(await getField(mockObjectType, ['listOfListFieldTest'])).toEqual(mockObjectType.fields.listOfListFieldTest)
    })
    it('should succeed on a map field', async () => {
      expect(await getField(mockObjectType, ['mapFieldTest'])).toEqual(mockObjectType.fields.mapFieldTest)
      expect(await getField(mockObjectType, ['mapOfMapFieldTest'])).toEqual(mockObjectType.fields.mapOfMapFieldTest)
    })
    it('should success on an inner type field', async () => {
      expect(await getField(mockObjectType, ['innerTypeFieldTest'])).toEqual(mockObjectType.fields.innerTypeFieldTest)
      expect(await getField(mockObjectType, ['innerTypeFieldTest', 'innerField'])).toEqual(innerType.fields.innerField)
    })
    it('should success on an inner type in a list field', async () => {
      expect(await getField(mockObjectType, ['listOfInnerTypeFieldTest'])).toEqual(
        mockObjectType.fields.listOfInnerTypeFieldTest,
      )
      expect(await getField(mockObjectType, ['listOfInnerTypeFieldTest', '1', 'innerField'])).toEqual(
        innerType.fields.innerField,
      )
    })
    it('should return the closest parent field when the rest of the path is map/list keys', async () => {
      expect(await getField(mockObjectType, ['listOfInnerTypeFieldTest', '1'])).toEqual(
        mockObjectType.fields.listOfInnerTypeFieldTest,
      )
    })
    it('should return undefined on a nonexistent field', async () => {
      expect(await getField(mockObjectType, ['nonExistentField'])).toBeUndefined()
    })
    it('should return undefined on empty path', async () => {
      expect(await getField(mockObjectType, [])).toBeUndefined()
    })
    it('should return undefined on path to annotation', async () => {
      expect(await getField(mockObjectType, ['someAnno', 'innerField'])).toBeUndefined()
    })
  })
  describe('getFieldType', () => {
    it('should succeed on a standard field', async () => {
      expect(await getFieldType(mockObjectType, ['fieldTest'])).toEqual(BuiltinTypes.NUMBER)
    })
    it('should succeed on a list field', async () => {
      expect(await getFieldType(mockObjectType, ['listFieldTest'])).toEqual(new ListType(BuiltinTypes.NUMBER))
      expect(await getFieldType(mockObjectType, ['listFieldTest', '1'])).toEqual(BuiltinTypes.NUMBER)
      expect(await getFieldType(mockObjectType, ['listOfListFieldTest'])).toEqual(
        new ListType(new ListType(BuiltinTypes.NUMBER)),
      )
      expect(await getFieldType(mockObjectType, ['listOfListFieldTest', '1'])).toEqual(
        new ListType(BuiltinTypes.NUMBER),
      )
      expect(await getFieldType(mockObjectType, ['listOfListFieldTest', '1', '1'])).toEqual(BuiltinTypes.NUMBER)
    })
    it('should succeed on a map field', async () => {
      expect(await getFieldType(mockObjectType, ['mapFieldTest'])).toEqual(new MapType(BuiltinTypes.NUMBER))
      expect(await getFieldType(mockObjectType, ['mapFieldTest', 'key'])).toEqual(BuiltinTypes.NUMBER)
      expect(await getFieldType(mockObjectType, ['mapOfMapFieldTest'])).toEqual(
        new MapType(new MapType(BuiltinTypes.NUMBER)),
      )
      expect(await getFieldType(mockObjectType, ['mapOfMapFieldTest', 'a'])).toEqual(new MapType(BuiltinTypes.NUMBER))
      expect(await getFieldType(mockObjectType, ['mapOfMapFieldTest', 'a', 'b'])).toEqual(BuiltinTypes.NUMBER)
    })
    it('should success on an inner type field', async () => {
      expect(await getFieldType(mockObjectType, ['innerTypeFieldTest'])).toEqual(innerType)
      expect(await getFieldType(mockObjectType, ['innerTypeFieldTest', 'innerField'])).toEqual(BuiltinTypes.STRING)
    })
    it('should success on an inner type in a list field', async () => {
      expect(await getFieldType(mockObjectType, ['listOfInnerTypeFieldTest'])).toEqual(new ListType(innerType))
      expect(await getFieldType(mockObjectType, ['listOfInnerTypeFieldTest', '1'])).toEqual(innerType)
      expect(await getFieldType(mockObjectType, ['listOfInnerTypeFieldTest', '1', 'innerField'])).toEqual(
        BuiltinTypes.STRING,
      )
    })
    it('should return undefined on a nonexistent field', async () => {
      expect(await getFieldType(mockObjectType, ['nonExistentField'])).toBeUndefined()
    })
    it('should return undefined on empty path', async () => {
      expect(await getFieldType(mockObjectType, [])).toBeUndefined()
    })
    it('should return undefined on non-number ListType key', async () => {
      expect(await getFieldType(mockObjectType, ['listFieldTest', 'NaN'])).toBeUndefined()
    })
    it('should return undefined on path to annotation', async () => {
      expect(await getFieldType(mockObjectType, ['someAnno', 'innerField'])).toBeUndefined()
    })
  })
  describe('test error verification', () => {
    it('should return true when given an error that has elemID', () => {
      expect(
        isSaltoElementError({
          message: '',
          severity: 'Error',
          elemID: new ElemID(''),
          detailedMessage: '',
        }),
      ).toBeTruthy()
    })
    it('should return false when given an error that has elemID which is undefined', () => {
      expect(
        isSaltoElementError({
          message: '',
          severity: 'Error',
          elemID: undefined,
          detailedMessage: '',
        }),
      ).toBeFalsy()
    })
    it('should return false when given an error that does not have elemID', () => {
      expect(
        isSaltoElementError({
          message: '',
          severity: 'Error',
          detailedMessage: '',
        }),
      ).toBeFalsy()
    })
  })
})
