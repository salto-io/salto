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
import {
  ObjectType,
  ElemID,
  BuiltinTypes,
  Field,
  InstanceElement,
  createRefToElmWithValue,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import {
  addDefaults, getNamespaceFromString,
  isCustomMetadataRecordInstance,
  isCustomMetadataRecordType,
  isMetadataValues, isRestrictableField,
} from '../../src/filters/utils'
import {
  SALESFORCE,
  LABEL,
  API_NAME,
  INSTANCE_FULL_NAME_FIELD,
  METADATA_TYPE,
  CUSTOM_OBJECT,
  CUSTOM_SETTINGS_TYPE, FIELD_ANNOTATIONS,
} from '../../src/constants'
import { createInstanceElement, Types } from '../../src/transformers/transformer'
import { CustomObject } from '../../src/client/types'
import { mockTypes } from '../mock_elements'
import { createCustomObjectType } from '../utils'

describe('utils', () => {
  describe('addDefaults', () => {
    describe('when called with instance', () => {
      let instance: InstanceElement
      beforeEach(async () => {
        instance = new InstanceElement('test', mockTypes.Profile)
        await addDefaults(instance)
      })
      it('should add api name', () => {
        expect(instance.value).toHaveProperty(INSTANCE_FULL_NAME_FIELD, 'test')
      })
    })
    describe('when called with custom object instance', () => {
      let instance: InstanceElement
      beforeEach(async () => {
        const customObj = createCustomObjectType('test', {})
        instance = new InstanceElement('test', customObj)
        await addDefaults(instance)
      })
      it('should not add api name', () => {
        expect(instance.value).not.toHaveProperty(INSTANCE_FULL_NAME_FIELD)
      })
    })
    describe('when called with field', () => {
      let field: Field
      beforeEach(async () => {
        const obj = new ObjectType({
          elemID: new ElemID(SALESFORCE, 'test'),
          fields: {
            a: { refType: Types.primitiveDataTypes.Text },
          },
          annotations: {
            [API_NAME]: 'test',
          },
        })
        field = obj.fields.a
        await addDefaults(field)
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
        beforeEach(async () => {
          object = new ObjectType({
            elemID: new ElemID(SALESFORCE, 'test'),
            fields: {
              a: { refType: Types.primitiveDataTypes.Text },
            },
          })

          await addDefaults(object)
        })
        it('should add annotation values', () => {
          expect(object.annotations).toMatchObject({
            [API_NAME]: 'test__c',
            [METADATA_TYPE]: CUSTOM_OBJECT,
            [LABEL]: 'test',
          } as Partial<CustomObject>)
        })
        it('should add annotation types', () => {
          expect(object.annotationRefTypes).toMatchObject({
            [API_NAME]: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
            [METADATA_TYPE]: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
            [LABEL]: createRefToElmWithValue(BuiltinTypes.STRING),
          })
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
        beforeEach(async () => {
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
          await addDefaults(object)
        })
        it('should add missing annotations', () => {
          expect(object.annotations).toMatchObject({
            [API_NAME]: 'test__c',
          } as Partial<CustomObject>)
        })
        it('should not override existing annotations', () => {
          expect(object.annotations).toMatchObject({
            [LABEL]: 'myLabel',
            nameField: { type: 'AutoNumber', label: 'Name' },
          } as Partial<CustomObject>)
        })
        it('should add missing annotation types', () => {
          expect(object.annotationRefTypes).toMatchObject({
            [API_NAME]: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
            [LABEL]: createRefToElmWithValue(BuiltinTypes.STRING),
          })
        })
        it('should not override existing annotation types', () => {
          expect(object.annotationRefTypes).toMatchObject({
            sharingModel: createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING),
          })
        })
      })
    })
    describe('when called with custom settings', () => {
      let object: ObjectType
      beforeEach(async () => {
        object = new ObjectType({
          elemID: new ElemID(SALESFORCE, 'test'),
          annotations: {
            [CUSTOM_SETTINGS_TYPE]: 'Hierarchical',
          },
        })
        await addDefaults(object)
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
    describe('when called with custom metadata type', () => {
      const CUSTOM_METADATA_TYPE_NAME = 'TestCustomMetadataType__mdt'
      const CUSTOM_METADATA_TYPE_LABEL = 'TestMetadataTypeLabel'
      let object: ObjectType
      beforeEach(async () => {
        object = new ObjectType({
          elemID: new ElemID(SALESFORCE, CUSTOM_METADATA_TYPE_NAME),
          annotations: {
            [API_NAME]: CUSTOM_METADATA_TYPE_NAME,
            [LABEL]: CUSTOM_METADATA_TYPE_LABEL,
          },
        })
        await addDefaults(object)
      })
      it('should add annotation values', () => {
        expect(object.annotations).toMatchObject({
          [API_NAME]: CUSTOM_METADATA_TYPE_NAME,
          [METADATA_TYPE]: CUSTOM_OBJECT,
          [LABEL]: CUSTOM_METADATA_TYPE_LABEL,
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
  describe('isCustomMetadataRecordType', () => {
    it('should return true for customMetadataRecordType', async () => {
      expect(await isCustomMetadataRecordType(mockTypes.CustomMetadataRecordType)).toBeTrue()
    })
    it('should return false for non customMetadataRecordType', async () => {
      expect(await isCustomMetadataRecordType(mockTypes.Profile)).toBeFalse()
    })
  })
  describe('isCustomMetadataRecordInstance', () => {
    const customMetadataRecordInstance = createInstanceElement(
      { [INSTANCE_FULL_NAME_FIELD]: 'MDType.MDTypeInstance' },
      mockTypes.CustomMetadataRecordType
    )
    const profileInstance = createInstanceElement(
      { [INSTANCE_FULL_NAME_FIELD]: 'profileInstance' },
      mockTypes.Profile
    )
    it('should return true for customMetadataRecordType instance', async () => {
      expect(await isCustomMetadataRecordInstance(customMetadataRecordInstance)).toBeTrue()
    })
    it('should return false for non customMetadataRecordType', async () => {
      expect(await isCustomMetadataRecordInstance(profileInstance)).toBeFalse()
    })
  })
  describe('isMetadataValues', () => {
    it('should return true when values contain a fullName field', () => {
      expect(isMetadataValues({
        [INSTANCE_FULL_NAME_FIELD]: 'TestFullName',
        anotherProperty: 'anotherProperty',
      })).toBeTrue()
    })
    it('should return false when values does not contain a fullName field', () => {
      expect(isMetadataValues({
        anotherProperty: 'anotherProperty',
      })).toBeFalse()
    })
  })
  describe('isRestrictableField', () => {
    const FIELD_NAME = 'testField__c'
    let parent: ObjectType
    let field: Field

    beforeEach(() => {
      parent = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'TestObject'),
        fields: {
          [FIELD_NAME]: {
            refType: Types.primitiveDataTypes.Picklist,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
            },
          },
        },
        annotations: {
          [FIELD_ANNOTATIONS.UPDATEABLE]: true,
        },
      })
      field = parent.fields[FIELD_NAME]
    })

    describe('when parent is hidden', () => {
      beforeEach(() => {
        parent.annotations[CORE_ANNOTATIONS.HIDDEN] = true
      })
      describe('when field is hidden', () => {
        beforeEach(() => {
          field.annotations[CORE_ANNOTATIONS.HIDDEN] = true
        })
        it('should return false', () => {
          expect(isRestrictableField(field)).toBeFalse()
        })
      })
      describe('when field is not hidden', () => {
        it('should return false', () => {
          expect(isRestrictableField(field)).toBeFalse()
        })
      })
      describe('when field is updatable', () => {
        it('should return false', async () => {
          expect(isRestrictableField(field)).toBeFalse()
        })
      })
      describe('when field is not updatable', () => {
        beforeEach(() => {
          field.annotations[CORE_ANNOTATIONS.UPDATABLE] = false
        })
        it('should return false', async () => {
          expect(isRestrictableField(field)).toBeFalse()
        })
      })
    })
    describe('when parent is not hidden', () => {
      beforeEach(() => {
        parent.annotations[CORE_ANNOTATIONS.HIDDEN] = false
      })
      describe('when field is hidden value', () => {
        beforeEach(() => {
          field.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
        })
        it('should return false', () => {
          expect(isRestrictableField(field)).toBeFalse()
        })
      })
      describe('when field is hidden', () => {
        beforeEach(() => {
          field.annotations[CORE_ANNOTATIONS.HIDDEN] = true
        })
        it('should return false', () => {
          expect(isRestrictableField(field)).toBeFalse()
        })
      })
      describe('when field is not hidden', () => {
        it('should return true', () => {
          expect(isRestrictableField(field)).toBeTrue()
        })
      })
      describe('when field is updatable', () => {
        it('should return false', () => {
          expect(isRestrictableField(field)).toBeTrue()
        })
      })
      describe('when field is not updatable', () => {
        beforeEach(() => {
          field.annotations[CORE_ANNOTATIONS.UPDATABLE] = false
        })
        it('should return false', async () => {
          expect(isRestrictableField(field)).toBeFalse()
        })
      })
    })
  })
  describe('getNamespaceFromString', () => {
    const NAMESPACE = 'ns'
    type TestInput = {
      received: string
      expected: string | undefined
    }
    it.each<TestInput>([
      { received: 'Instance', expected: undefined },
      { received: 'CustomObject__c', expected: undefined },
      { received: 'CustomMetadata__mdt', expected: undefined },
      { received: 'Account.CustomField__c', expected: undefined },
      { received: 'Account-Layout Name', expected: undefined },
      {
        received: 'https://test.lightning.force.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/CustomField__c',
        expected: undefined,
      },
      { received: `${NAMESPACE}__Instance`, expected: NAMESPACE },
      { received: `Account.${NAMESPACE}__CustomField__c`, expected: NAMESPACE },
      { received: `${NAMESPACE}__CustomMetadata__mdt`, expected: NAMESPACE },
      { received: `${NAMESPACE}__CustomMetadata__mdt`, expected: NAMESPACE },
      { received: `Account-${NAMESPACE}__Layout Name`, expected: NAMESPACE },
      { received: `${NAMESPACE}__configurationSummary`, expected: NAMESPACE },
      {
        received: `https://test.lightning.force.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/${NAMESPACE}__CustomField__c`,
        expected: NAMESPACE,
      },
    ])('should return $expected for $received', ({ expected, received }) => {
      expect(getNamespaceFromString(received)).toEqual(expected)
    })
  })
})
