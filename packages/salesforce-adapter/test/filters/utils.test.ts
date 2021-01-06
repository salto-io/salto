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
import { ObjectType, ElemID, BuiltinTypes, Field, InstanceElement } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { addDefaults } from '../../src/filters/utils'
import { SALESFORCE, LABEL, API_NAME, CUSTOM_FIELD, INSTANCE_FULL_NAME_FIELD, METADATA_TYPE, CUSTOM_OBJECT, CUSTOM_SETTINGS_TYPE } from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import { CustomObject } from '../../src/client/types'
import { mockTypes } from '../mock_elements'
import { createCustomObjectType } from '../utils'

describe('addDefaults', () => {
  describe('when called with instance', () => {
    let instance: InstanceElement
    beforeEach(() => {
      instance = new InstanceElement('test', mockTypes.Profile)
      addDefaults(instance)
    })
    it('should add api name', () => {
      expect(instance.value).toHaveProperty(INSTANCE_FULL_NAME_FIELD, 'test')
    })
  })
  describe('when called with custom object instance', () => {
    let instance: InstanceElement
    beforeEach(() => {
      const customObj = createCustomObjectType('test', {})
      instance = new InstanceElement('test', customObj)
      addDefaults(instance)
    })
    it('should not add api name', () => {
      expect(instance.value).not.toHaveProperty(INSTANCE_FULL_NAME_FIELD)
    })
  })
  describe('when called with field', () => {
    let field: Field
    beforeEach(() => {
      const obj = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'test'),
        fields: {
          a: { refType: createRefToElmWithValue(Types.primitiveDataTypes.Text) },
        },
        annotations: {
          [API_NAME]: 'test',
        },
      })
      field = obj.fields.a
      addDefaults(field)
    })
    it('should add api name', () => {
      expect(field.annotations).toHaveProperty(API_NAME, 'test.a__c')
    })
    it('should add label', () => {
      expect(field.annotations).toHaveProperty(LABEL, 'a')
    })
  })
  describe('when called with custom object', () => {
    describe('when object has no annotations', () => {
      let object: ObjectType
      beforeEach(() => {
        object = new ObjectType({
          elemID: new ElemID(SALESFORCE, 'test'),
          fields: {
            a: { refType: createRefToElmWithValue(Types.primitiveDataTypes.Text) },
          },
        })

        addDefaults(object)
      })
      it('should add annotation values', () => {
        expect(object.annotations).toMatchObject({
          [API_NAME]: 'test__c',
          [METADATA_TYPE]: CUSTOM_OBJECT,
          [LABEL]: 'test',
          deploymentStatus: 'Deployed',
          pluralLabel: 'tests',
          nameField: { type: 'Text', label: 'Name' },
          sharingModel: 'ReadWrite',
        } as Partial<CustomObject>)
      })
      it('should add annotation types', () => {
        expect(object.annotationRefTypes).toMatchObject({
          [API_NAME]: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
          [METADATA_TYPE]: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
          [LABEL]: createRefToElmWithValue(BuiltinTypes.STRING),
          deploymentStatus: createRefToElmWithValue(BuiltinTypes.STRING),
          pluralLabel: createRefToElmWithValue(BuiltinTypes.STRING),
          sharingModel: createRefToElmWithValue(BuiltinTypes.STRING),
        })
        expect(object.annotationRefTypes.nameField?.elemID).toEqual(
          new ElemID(SALESFORCE, CUSTOM_FIELD)
        )
      })
      it('should add defaults to fields', () => {
        expect(object.fields.a.annotations).toMatchObject({
          [API_NAME]: 'test__c.a__c',
          [LABEL]: 'a',
        })
      })
    })
    describe('when object already has annotations', () => {
      let object: ObjectType
      beforeEach(() => {
        object = new ObjectType({
          elemID: new ElemID(SALESFORCE, 'test'),
          annotations: {
            [LABEL]: 'myLabel',
            nameField: { type: 'AutoNumber', label: 'Name' },
          },
          annotationRefsOrTypes: {
            sharingModel: BuiltinTypes.HIDDEN_STRING,
          },
        })
        addDefaults(object)
      })
      it('should add missing annotations', () => {
        expect(object.annotations).toMatchObject({
          [API_NAME]: 'test__c',
          sharingModel: 'ReadWrite',
        } as Partial<CustomObject>)
      })
      it('should not override existing annotations', () => {
        expect(object.annotations).toMatchObject({
          [LABEL]: 'myLabel',
          nameField: { type: 'AutoNumber', label: 'Name' },
        } as Partial<CustomObject>)
      })
      it('should add plural label according to the label', () => {
        expect(object.annotations).toHaveProperty('pluralLabel', 'myLabels')
      })
      it('should add missing annotation types', () => {
        expect(object.annotationRefTypes).toMatchObject({
          [API_NAME]: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
          [LABEL]: createRefToElmWithValue(BuiltinTypes.STRING),
        })
        expect(object.annotationRefTypes.nameField?.elemID).toEqual(
          new ElemID(SALESFORCE, CUSTOM_FIELD)
        )
      })
      it('should not override existing annotation types', () => {
        expect(object.annotationRefTypes).toMatchObject({
          sharingModel: createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING),
        })
      })
    })
    describe('when object has a master detail field', () => {
      let object: ObjectType
      beforeEach(() => {
        object = new ObjectType({
          elemID: new ElemID(SALESFORCE, 'test'),
          fields: {
            a: { refType: createRefToElmWithValue(Types.primitiveDataTypes.MasterDetail) },
          },
        })
        addDefaults(object)
      })
      it('should set sharing model to controlled by parent', () => {
        expect(object.annotations).toHaveProperty('sharingModel', 'ControlledByParent')
      })
    })
  })
  describe('when called with custom settings', () => {
    let object: ObjectType
    beforeEach(() => {
      object = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'test'),
        annotations: {
          [CUSTOM_SETTINGS_TYPE]: 'Hierarchical',
        },
      })
      addDefaults(object)
    })
    it('should add annotation values', () => {
      expect(object.annotations).toMatchObject({
        [API_NAME]: 'test__c',
        [METADATA_TYPE]: CUSTOM_OBJECT,
        [LABEL]: 'test',
      })
    })
    it('should add annotation types', () => {
      expect(object.annotationRefTypes).toMatchObject({
        [API_NAME]: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        [METADATA_TYPE]: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        [LABEL]: createRefToElmWithValue(BuiltinTypes.STRING),
      })
    })
    it('should not add custom object annotations', () => {
      expect(object.annotations).not.toHaveProperty('sharingModel')
      expect(object.annotations).not.toHaveProperty('deploymentStatus')
    })
  })
})
