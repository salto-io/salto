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

import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  Field,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  TypeReference,
} from '@salto-io/adapter-api'
import { extractAdditionalPropertiesField, setAdditionalPropertiesAnnotation } from '../src/additional_properties'

describe('additional_properties', () => {
  describe('setAdditionalPropertiesAnnotation', () => {
    it('should set additional properties annotation', () => {
      const type = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: { field: { refType: BuiltinTypes.STRING } },
      })
      const typeAdditionalProperties = new ObjectType({
        elemID: new ElemID('test', 'type.additionalProperties'),
        fields: { field: { refType: BuiltinTypes.STRING } },
      })
      const annotation = { refType: new ReferenceExpression(typeAdditionalProperties.elemID, typeAdditionalProperties) }
      expect(
        setAdditionalPropertiesAnnotation(type, annotation).annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES],
      ).toEqual(annotation)
    })
  })
  describe('extractAdditionalPropertiesField', () => {
    const baseObj = new ObjectType({
      elemID: new ElemID('test'),
      fields: { field: { refType: BuiltinTypes.STRING } },
    })
    const fieldName = 'mock field name'
    describe('when there is no additional properties annotation', () => {
      it('should return Field with unknown type', () => {
        expect(extractAdditionalPropertiesField(baseObj, fieldName)).toEqual(
          new Field(baseObj, fieldName, BuiltinTypes.UNKNOWN),
        )
      })
    })
    describe('when additional properties refType references something other than a type (should not happen)', () => {
      it('should return undefined', () => {
        const objType = baseObj.clone()
        const someInst = new InstanceElement('mockInst', baseObj)
        objType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = {
          refType: new ReferenceExpression(someInst.elemID, someInst),
        }
        expect(extractAdditionalPropertiesField(objType, fieldName)).toBeUndefined()
      })
    })
    describe('when additional properties annotation is false', () => {
      it('should return undefined', () => {
        const objType = baseObj.clone()
        objType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false
        expect(extractAdditionalPropertiesField(objType, fieldName)).toBeUndefined()
      })
    })
    describe('when additional properties annotation is defining a type', () => {
      it('should return the type', () => {
        const objType = baseObj.clone()
        const additionalPropertiesObjType = new ObjectType({
          elemID: new ElemID('adapter', 'additionalProperties'),
          fields: { field: { refType: BuiltinTypes.STRING } },
        })
        objType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = {
          refType: new ReferenceExpression(additionalPropertiesObjType.elemID, additionalPropertiesObjType),
          annotations: { someUniqueAnnotation: 'unique' },
        }
        expect(extractAdditionalPropertiesField(objType, fieldName)).toEqual(
          new Field(objType, fieldName, additionalPropertiesObjType, { someUniqueAnnotation: 'unique' }),
        )
      })
    })
    describe('when additional properties annotation is defining a type but the type is not loaded', () => {
      it('should return the type', () => {
        const objType = baseObj.clone()
        const additionalPropertiesObjType = new ObjectType({
          elemID: new ElemID('adapter', 'additionalProperties'),
          fields: { field: { refType: BuiltinTypes.STRING } },
        })
        objType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = {
          refType: new ReferenceExpression(additionalPropertiesObjType.elemID),
          annotations: { someUniqueAnnotation: 'unique' },
        }
        expect(extractAdditionalPropertiesField(objType, fieldName)).toEqual(
          new Field(objType, fieldName, new TypeReference(new ElemID('adapter', 'additionalProperties')), {
            someUniqueAnnotation: 'unique',
          }),
        )
      })
    })
  })
})
