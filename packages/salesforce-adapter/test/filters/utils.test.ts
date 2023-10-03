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
  BuiltinTypes,
  createRefToElmWithValue,
  ElemID,
  Field,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  addDefaults, getChangedAtSingleton,
  getNamespace,
  isCustomMetadataRecordInstance,
  isCustomMetadataRecordType, isCustomType,
  isMetadataValues,
  isStandardObject,
  layoutObjAndName,
} from '../../src/filters/utils'
import {
  API_NAME,
  CUSTOM_OBJECT,
  CUSTOM_SETTINGS_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  LABEL,
  METADATA_TYPE,
  SALESFORCE,
} from '../../src/constants'
import { createInstanceElement, Types } from '../../src/transformers/transformer'
import { CustomObject } from '../../src/client/types'
import { mockInstances, mockTypes } from '../mock_elements'
import { createCustomObjectType } from '../utils'
import { INSTANCE_SUFFIXES } from '../../src/types'

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
  describe('getNamespace', () => {
    describe('without namespace', () => {
      it.each([
        'Instance',
        'Parent.Instance',
        ...INSTANCE_SUFFIXES.map(suffix => `Instance__${suffix}`),
      ])('%s', async (name: string) => {
        const instance = createInstanceElement({ [INSTANCE_FULL_NAME_FIELD]: name }, mockTypes.Profile)
        expect(await getNamespace(instance)).toBeUndefined()
      })
      it('Layout instance', async () => {
        const instance = createInstanceElement({ [INSTANCE_FULL_NAME_FIELD]: 'Account-Test Layout-Name' }, mockTypes.Layout)
        expect(await getNamespace(instance)).toBeUndefined()
      })
    })
    describe('with namespace', () => {
      const NAMESPACE = 'ns'
      it.each([
        `${NAMESPACE}__Instance`,
        `Parent.${NAMESPACE}__Instance`,
        `${NAMESPACE}__configurationSummary`, // There was an edge-case where __c was replaced and caused incorrect result
        ...INSTANCE_SUFFIXES.map(suffix => `${NAMESPACE}__Instance__${suffix}`),
      ])('%s', async (name: string) => {
        const instance = createInstanceElement({ [INSTANCE_FULL_NAME_FIELD]: name }, mockTypes.Profile)
        expect(await getNamespace(instance)).toEqual(NAMESPACE)
      })
      it('Layout instance', async () => {
        const instance = createInstanceElement({ [INSTANCE_FULL_NAME_FIELD]: `Account-${NAMESPACE}__Test Layout-Name` }, mockTypes.Layout)
        expect(await getNamespace(instance)).toEqual(NAMESPACE)
      })
    })
  })
  describe('isStandardObject', () => {
    it('should return true for Standard CustomObject', async () => {
      expect(await isStandardObject(mockTypes.Account)).toBeTrue()
    })
    it('should return false for object with no custom suffix that is not of type CustomObject', async () => {
      expect(await isStandardObject(mockTypes.Profile)).toBeFalse()
    })
    describe('when CustomObject has a custom suffix', () => {
      it.each(INSTANCE_SUFFIXES.map(suffix => `TestObject__${suffix}`))('Should return false for CustomObject with name TestObject__%s', async (customObjectName: string) => {
        const customObject = createCustomObjectType(customObjectName, {})
        expect(await isStandardObject(customObject)).toBeFalse()
      })
    })
  })
  describe('layoutObjAndName', () => {
    it.each([
      ['Account-Layout Name', 'Account', 'Layout Name'],
      ['Account-SBQQ__Layout Name', 'Account', 'SBQQ__Layout Name'],
      ['SBQQ__Account__c-Layout Name', 'SBQQ__Account__c', 'Layout Name'],
      ['Account-Layout-Complex-Name', 'Account', 'Layout-Complex-Name'],
    ])('%s', (layoutApiName, expectedObjectName, expectedLayoutName) => {
      expect(layoutObjAndName(layoutApiName)).toEqual([expectedObjectName, expectedLayoutName])
    })
  })
  describe('getChangedAtSingleton', () => {
    let elementsSource: ReadOnlyElementsSource

    describe('when the ChangedAtSingleton instance exists in the elementsSource', () => {
      let changedAtSingleton: InstanceElement
      beforeEach(() => {
        changedAtSingleton = mockInstances().ChangedAtSingleton
        elementsSource = buildElementsSourceFromElements([changedAtSingleton])
      })
      it('should return the singleton', async () => {
        expect(await getChangedAtSingleton(elementsSource)).toEqual(changedAtSingleton)
      })
    })

    describe('when the ChangedAtSingleton instance does not exist in the elementsSource', () => {
      beforeEach(() => {
        elementsSource = buildElementsSourceFromElements([])
      })
      it('should return undefined', async () => {
        expect(await getChangedAtSingleton(elementsSource)).toBeUndefined()
      })
    })
  })
  describe('isCustomType', () => {
    it('should return true for custom types', () => {
      expect(isCustomType(mockTypes.SBQQ__Template__c)).toBeTrue()
      expect(isCustomType(mockTypes.CustomMetadataRecordType)).toBeTrue()
    })
    it('should return false for non custom types', () => {
      expect(isCustomType(mockTypes.Profile)).toBeFalse()
      expect(isCustomType(mockTypes.ApexPage)).toBeFalse()
      expect(isCustomType(mockTypes.CustomObject)).toBeFalse()
      expect(isCustomType(mockTypes.Product2)).toBeFalse()
    })
  })
})
