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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  BuiltinTypes,
  Change,
  CORE_ANNOTATIONS,
  createRefToElmWithValue,
  ElemID,
  Field,
  InstanceElement,
  ListType,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
  toChange,
  TypeReference,
  Values,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  addDefaults,
  toListType,
  getChangedAtSingletonInstance,
  getNamespace,
  isCustomMetadataRecordInstance,
  isCustomMetadataRecordType,
  isCustomType,
  isMetadataValues,
  isStandardObject,
  layoutObjAndName,
  isInstanceOfTypeChangeSync,
  isInstanceOfTypeSync,
  isDeactivatedFlowChange,
  isDeactivatedFlowChangeOnly,
  getAuthorInformationFromFileProps,
  isElementWithResolvedParent,
  getElementAuthorInformation,
  getNamespaceSync,
  referenceFieldTargetTypes,
  isStandardObjectSync,
  isStandardField,
  getFullName,
  isInstanceOfCustomObjectSync,
  isInstanceOfCustomObjectChangeSync,
  aliasOrElemID,
  getMostRecentFileProperties,
  getFLSProfiles,
  toCustomField,
  toCustomProperties,
} from '../../src/filters/utils'
import {
  API_NAME,
  COMPOUND_FIELD_TYPE_NAMES,
  CUSTOM_OBJECT,
  CUSTOM_SETTINGS_TYPE,
  DEFAULT_FLS_PROFILES,
  DESCRIPTION,
  FIELD_ANNOTATIONS,
  FIELD_DEPENDENCY_FIELDS,
  FIELD_TYPE_NAMES,
  FILTER_ITEM_FIELDS,
  INSTANCE_FULL_NAME_FIELD,
  INTERNAL_ID_ANNOTATION,
  LABEL,
  METADATA_TYPE,
  SALESFORCE,
  STATUS,
  UNIX_TIME_ZERO_STRING,
  VALUE_SETTINGS_FIELDS,
  VALUE_SET_FIELDS,
} from '../../src/constants'
import {
  createInstanceElement,
  Types,
} from '../../src/transformers/transformer'
import {
  CustomField,
  CustomObject,
  CustomPicklistValue,
  FilterItem,
} from '../../src/client/types'
import { createFlowChange, mockInstances, mockTypes } from '../mock_elements'
import {
  createCustomObjectType,
  createField,
  createValueSetEntry,
} from '../utils'
import { INSTANCE_SUFFIXES } from '../../src/types'
import { mockFileProperties } from '../connection'

const { makeArray } = collections.array

describe('filter utils', () => {
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
      expect(
        await isCustomMetadataRecordType(mockTypes.CustomMetadataRecordType),
      ).toBeTrue()
    })
    it('should return false for non customMetadataRecordType', async () => {
      expect(await isCustomMetadataRecordType(mockTypes.Profile)).toBeFalse()
    })
  })
  describe('isCustomMetadataRecordInstance', () => {
    const customMetadataRecordInstance = createInstanceElement(
      { [INSTANCE_FULL_NAME_FIELD]: 'MDType.MDTypeInstance' },
      mockTypes.CustomMetadataRecordType,
    )
    const profileInstance = createInstanceElement(
      { [INSTANCE_FULL_NAME_FIELD]: 'profileInstance' },
      mockTypes.Profile,
    )
    it('should return true for customMetadataRecordType instance', async () => {
      expect(
        await isCustomMetadataRecordInstance(customMetadataRecordInstance),
      ).toBeTrue()
    })
    it('should return false for non customMetadataRecordType', async () => {
      expect(await isCustomMetadataRecordInstance(profileInstance)).toBeFalse()
    })
  })
  describe('isMetadataValues', () => {
    it('should return true when values contain a fullName field', () => {
      expect(
        isMetadataValues({
          [INSTANCE_FULL_NAME_FIELD]: 'TestFullName',
          anotherProperty: 'anotherProperty',
        }),
      ).toBeTrue()
    })
    it('should return false when values does not contain a fullName field', () => {
      expect(
        isMetadataValues({
          anotherProperty: 'anotherProperty',
        }),
      ).toBeFalse()
    })
  })
  describe('getNamespace', () => {
    describe('without namespace', () => {
      it.each([
        'Instance',
        'Parent.Instance',
        ...INSTANCE_SUFFIXES.map((suffix) => `Instance__${suffix}`),
      ])('%s', async (name: string) => {
        const instance = createInstanceElement(
          { [INSTANCE_FULL_NAME_FIELD]: name },
          mockTypes.Profile,
        )
        expect(await getNamespace(instance)).toBeUndefined()
      })
      it('Layout instance', async () => {
        const instance = createInstanceElement(
          { [INSTANCE_FULL_NAME_FIELD]: 'Account-Test Layout-Name' },
          mockTypes.Layout,
        )
        expect(await getNamespace(instance)).toBeUndefined()
      })
    })
    describe('with namespace', () => {
      const NAMESPACE = 'ns'
      it.each([
        `${NAMESPACE}__Instance`,
        `Parent.${NAMESPACE}__Instance`,
        `${NAMESPACE}__configurationSummary`, // There was an edge-case where __c was replaced and caused incorrect result
        ...INSTANCE_SUFFIXES.map(
          (suffix) => `${NAMESPACE}__Instance__${suffix}`,
        ),
      ])('%s', async (name: string) => {
        const instance = createInstanceElement(
          { [INSTANCE_FULL_NAME_FIELD]: name },
          mockTypes.Profile,
        )
        expect(await getNamespace(instance)).toEqual(NAMESPACE)
      })
      it('Layout instance', async () => {
        const instance = createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: `Account-${NAMESPACE}__Test Layout-Name`,
          },
          mockTypes.Layout,
        )
        expect(await getNamespace(instance)).toEqual(NAMESPACE)
      })
    })
  })
  describe('getNamespaceSync', () => {
    describe('without namespace', () => {
      it.each([
        'Instance',
        'Parent.Instance',
        ...INSTANCE_SUFFIXES.map((suffix) => `Instance__${suffix}`),
      ])('%s', (name: string) => {
        const instance = createInstanceElement(
          { [INSTANCE_FULL_NAME_FIELD]: name },
          mockTypes.Profile,
        )
        expect(getNamespaceSync(instance)).toBeUndefined()
      })
      it('Layout instance', () => {
        const instance = createInstanceElement(
          { [INSTANCE_FULL_NAME_FIELD]: 'Account-Test Layout-Name' },
          mockTypes.Layout,
        )
        expect(getNamespaceSync(instance)).toBeUndefined()
      })
    })
    describe('with namespace', () => {
      const NAMESPACE = 'ns'
      it.each([
        `${NAMESPACE}__Instance`,
        `Parent.${NAMESPACE}__Instance`,
        `${NAMESPACE}__configurationSummary`, // There was an edge-case where __c was replaced and caused incorrect result
        ...INSTANCE_SUFFIXES.map(
          (suffix) => `${NAMESPACE}__Instance__${suffix}`,
        ),
      ])('%s', (name: string) => {
        const instance = createInstanceElement(
          { [INSTANCE_FULL_NAME_FIELD]: name },
          mockTypes.Profile,
        )
        expect(getNamespaceSync(instance)).toEqual(NAMESPACE)
      })
      it('Layout instance', () => {
        const instance = createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: `Account-${NAMESPACE}__Test Layout-Name`,
          },
          mockTypes.Layout,
        )
        expect(getNamespaceSync(instance)).toEqual(NAMESPACE)
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
      it.each(INSTANCE_SUFFIXES.map((suffix) => `TestObject__${suffix}`))(
        'Should return false for CustomObject with name TestObject__%s',
        async (customObjectName: string) => {
          const customObject = createCustomObjectType(customObjectName, {})
          expect(await isStandardObject(customObject)).toBeFalse()
        },
      )
    })
  })
  describe('isStandardObjectSync', () => {
    it('should return true for Standard CustomObject', () => {
      expect(mockTypes.Account).toSatisfy(isStandardObjectSync)
    })
    it('should return false for object with no custom suffix that is not of type CustomObject', () => {
      expect(mockTypes.Profile).not.toSatisfy(isStandardObjectSync)
    })
    describe('when CustomObject has a custom suffix', () => {
      it.each(INSTANCE_SUFFIXES.map((suffix) => `TestObject__${suffix}`))(
        'Should return false for CustomObject with name TestObject__%s',
        (customObjectName: string) => {
          const customObject = createCustomObjectType(customObjectName, {})
          expect(customObject).not.toSatisfy(isStandardObjectSync)
        },
      )
    })
  })
  describe('layoutObjAndName', () => {
    it.each([
      ['Account-Layout Name', 'Account', 'Layout Name'],
      ['Account-SBQQ__Layout Name', 'Account', 'SBQQ__Layout Name'],
      ['SBQQ__Account__c-Layout Name', 'SBQQ__Account__c', 'Layout Name'],
      ['Account-Layout-Complex-Name', 'Account', 'Layout-Complex-Name'],
    ])('%s', (layoutApiName, expectedObjectName, expectedLayoutName) => {
      expect(layoutObjAndName(layoutApiName)).toEqual([
        expectedObjectName,
        expectedLayoutName,
      ])
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
        expect(await getChangedAtSingletonInstance(elementsSource)).toEqual(
          changedAtSingleton,
        )
      })
    })

    describe('when the ChangedAtSingleton instance does not exist in the elementsSource', () => {
      beforeEach(() => {
        elementsSource = buildElementsSourceFromElements([])
      })
      it('should return undefined', async () => {
        expect(
          await getChangedAtSingletonInstance(elementsSource),
        ).toBeUndefined()
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
  describe('isElementWithResolvedParent', () => {
    let instance: InstanceElement
    let parent: ObjectType

    beforeEach(() => {
      instance = createInstanceElement(
        { [INSTANCE_FULL_NAME_FIELD]: 'TestFullName' },
        mockTypes.WebLink,
      )
      parent = mockTypes.Account
    })
    it('should return false for element with unresolved parent', () => {
      instance.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(
        parent.elemID,
      )
      expect(isElementWithResolvedParent(instance)).toBeFalse()
    })
    it('should return false for element with no parent', () => {
      expect(isElementWithResolvedParent(instance)).toBeFalse()
    })
    it('should return false when parent is not an Element', () => {
      instance.annotations[CORE_ANNOTATIONS.PARENT] = 'Account'
      expect(isElementWithResolvedParent(instance)).toBeFalse()
    })
    it('should return true when parent is an Element', () => {
      instance.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(
        parent.elemID,
        parent,
      )
      expect(isElementWithResolvedParent(instance)).toBeTrue()
    })
  })

  describe('getAuthorInformationFromFileProps', () => {
    it('should return correct author information when values are non empty strings', () => {
      const fileProps = mockFileProperties({
        fullName: 'Custom__c',
        type: 'test',
        // The _created_at and _created_By values should be these
        createdByName: 'test',
        createdDate: '2023-01-01T16:28:30.000Z',
        lastModifiedByName: 'test2',
        lastModifiedDate: '2023-02-01T16:28:30.000Z',
      })
      expect(getAuthorInformationFromFileProps(fileProps)).toEqual({
        createdBy: 'test',
        createdAt: '2023-01-01T16:28:30.000Z',
        changedBy: 'test2',
        changedAt: '2023-02-01T16:28:30.000Z',
      })
    })
    it('should return correct author information when values are empty strings', () => {
      const fileProps = mockFileProperties({
        fullName: 'Custom__c',
        type: 'test',
        // The _created_at and _created_By values should be these
        createdByName: '',
        createdDate: '',
        lastModifiedByName: '',
        lastModifiedDate: '',
      })
      expect(getAuthorInformationFromFileProps(fileProps)).toEqual({
        createdBy: '',
        createdAt: '',
        changedBy: '',
        changedAt: '',
      })
    })
  })

  describe('getElementAuthorInformation', () => {
    let instance: InstanceElement

    beforeEach(() => {
      instance = createInstanceElement(
        { [INSTANCE_FULL_NAME_FIELD]: 'TestFullName' },
        mockTypes.WebLink,
      )
    })

    it('should return undefined on all properties when element is not annotated with any', () => {
      expect(getElementAuthorInformation(instance)).toEqual({
        createdBy: undefined,
        createdAt: undefined,
        changedBy: undefined,
        changedAt: undefined,
      })
    })

    it('should return correct properties when element is annotated with some', () => {
      instance.annotations[CORE_ANNOTATIONS.CREATED_BY] = 'test'
      instance.annotations[CORE_ANNOTATIONS.CREATED_AT] =
        '2023-01-01T16:28:30.000Z'
      expect(getElementAuthorInformation(instance)).toEqual({
        createdBy: 'test',
        createdAt: '2023-01-01T16:28:30.000Z',
        changedBy: undefined,
        changedAt: undefined,
      })
    })

    it('should return correct properties when element is annotated with all', () => {
      instance.annotations[CORE_ANNOTATIONS.CREATED_BY] = 'test'
      instance.annotations[CORE_ANNOTATIONS.CREATED_AT] =
        '2023-01-01T16:28:30.000Z'
      instance.annotations[CORE_ANNOTATIONS.CHANGED_BY] = 'test2'
      instance.annotations[CORE_ANNOTATIONS.CHANGED_AT] =
        '2023-01-01T16:28:30.000Z'
      expect(getElementAuthorInformation(instance)).toEqual({
        createdBy: 'test',
        createdAt: '2023-01-01T16:28:30.000Z',
        changedBy: 'test2',
        changedAt: '2023-01-01T16:28:30.000Z',
      })
    })
  })
  describe('toListType', () => {
    it('should wrap a non List type', () => {
      expect(toListType(mockTypes.Profile)).toEqual(
        new ListType(mockTypes.Profile),
      )
    })
    it('should not wrap a List type', () => {
      expect(toListType(new ListType(mockTypes.Profile))).toEqual(
        new ListType(mockTypes.Profile),
      )
    })
  })
  describe('isInstanceOfTypeSync and isInstanceOfTypeChangeSync', () => {
    let instance: InstanceElement
    let instanceWithUnresolvedType: InstanceElement
    beforeEach(() => {
      instance = createInstanceElement(
        {
          [INSTANCE_FULL_NAME_FIELD]: 'TestInstance',
          description: 'Test Instance',
        },
        mockTypes.Profile,
      )
      instanceWithUnresolvedType = new InstanceElement(
        'UnresolvedTestInstance',
        new TypeReference(mockTypes.Profile.elemID),
      )
    })
    describe('isInstanceOfTypeSync', () => {
      it('should return true when the resolved instance type is one of the provided types', () => {
        expect(instance).toSatisfy(isInstanceOfTypeSync('Profile'))
        expect(instance).toSatisfy(isInstanceOfTypeSync('Profile', 'Flow'))
      })
      it('should return false when the resolved instance type is not one of the provided types', () => {
        expect(instance).not.toSatisfy(isInstanceOfTypeSync('Flow'))
        expect(instance).not.toSatisfy(
          isInstanceOfTypeSync('Flow', 'ApexClass'),
        )
      })
      it('should return true when the unresolved instance type is one of the provided types', () => {
        expect(instanceWithUnresolvedType).toSatisfy(
          isInstanceOfTypeSync('Profile'),
        )
        expect(instanceWithUnresolvedType).toSatisfy(
          isInstanceOfTypeSync('Profile', 'Flow'),
        )
      })
      it('should return false when the unresolved instance type is not one of the provided types', () => {
        expect(instanceWithUnresolvedType).not.toSatisfy(
          isInstanceOfTypeSync('Flow'),
        )
        expect(instanceWithUnresolvedType).not.toSatisfy(
          isInstanceOfTypeSync('Flow', 'ApexClass'),
        )
      })
      it('should return false for a type element', () => {
        expect(mockTypes.Profile).not.toSatisfy(isInstanceOfTypeSync('Profile'))
      })
    })
    describe('isInstanceOfTypeChangeSync', () => {
      let change: Change
      beforeEach(() => {
        change = toChange({ after: instance })
      })
      it('should return true when the changed instance type is one of the provided types', () => {
        expect(change).toSatisfy(isInstanceOfTypeChangeSync('Profile'))
        expect(change).toSatisfy(isInstanceOfTypeChangeSync('Profile', 'Flow'))
      })
      it('should return false when the changed instance type is not one of the provided types', () => {
        expect(change).not.toSatisfy(isInstanceOfTypeChangeSync('Flow'))
        expect(change).not.toSatisfy(
          isInstanceOfTypeChangeSync('Flow', 'ApexClass'),
        )
      })
    })
  })

  describe('isDeactivatedFlowChange', () => {
    it('should return true when Flow is deactivated', () => {
      const deactivatedFlowChange = createFlowChange({
        flowApiName: 'flow',
        beforeStatus: 'Active',
        afterStatus: 'Draft',
      })
      expect(deactivatedFlowChange).toSatisfy(isDeactivatedFlowChange)
    })
    it('should return false when flow is activated', () => {
      const activatedFlowChange = createFlowChange({
        flowApiName: 'flow',
        beforeStatus: 'Draft',
        afterStatus: 'Active',
      })
      expect(activatedFlowChange).not.toSatisfy(isDeactivatedFlowChange)
    })
    it('should return false when flow was already inactive', () => {
      const activatedFlowChange = createFlowChange({
        flowApiName: 'flow',
        beforeStatus: 'Draft',
        afterStatus: 'Obsolete',
      })
      expect(activatedFlowChange).not.toSatisfy(isDeactivatedFlowChange)
    })
    it('should return false for added inactive flow', () => {
      const activatedFlowChange = createFlowChange({
        flowApiName: 'flow',
        afterStatus: 'Active',
      })
      expect(activatedFlowChange).not.toSatisfy(isDeactivatedFlowChange)
    })
    it('should return false when a non Flow instance was deactivated', () => {
      const workflowChange = toChange({
        before: createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'workflow',
            [STATUS]: 'Active',
          },
          mockTypes.Workflow,
        ),
        after: createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'workflow',
            [STATUS]: 'Draft',
          },
          mockTypes.Workflow,
        ),
      })
      expect(workflowChange).not.toSatisfy(isDeactivatedFlowChange)
    })

    describe('isDeactivatedFlowChangeOnly', () => {
      it('should return true for deactivated Flow change with no additional modifications', () => {
        const deactivatedFlowChange = createFlowChange({
          flowApiName: 'flow',
          beforeStatus: 'Active',
          afterStatus: 'Draft',
        })
        expect(deactivatedFlowChange).toSatisfy(isDeactivatedFlowChangeOnly)
      })
      it('should return false for deactivated Flow change with additional modifications', () => {
        const deactivatedFlowChange = createFlowChange({
          flowApiName: 'flow',
          beforeStatus: 'Active',
          afterStatus: 'Draft',
          additionalModifications: true,
        })
        expect(deactivatedFlowChange).not.toSatisfy(isDeactivatedFlowChangeOnly)
      })
      it('should return false for activated Flow change with no additional modifications', () => {
        const deactivatedFlowChange = createFlowChange({
          flowApiName: 'flow',
          beforeStatus: 'Draft',
          afterStatus: 'Active',
        })
        expect(deactivatedFlowChange).not.toSatisfy(isDeactivatedFlowChangeOnly)
      })
      it('should return false for addition of inactive Flow', () => {
        const deactivatedFlowChange = createFlowChange({
          flowApiName: 'flow',
          afterStatus: 'Active',
        })
        expect(deactivatedFlowChange).not.toSatisfy(isDeactivatedFlowChangeOnly)
      })
      it('should return false when a non Flow instance was deactivated with no additional changes', () => {
        const workflowChange = toChange({
          before: createInstanceElement(
            {
              [INSTANCE_FULL_NAME_FIELD]: 'workflow',
              [STATUS]: 'Active',
            },
            mockTypes.Workflow,
          ),
          after: createInstanceElement(
            {
              [INSTANCE_FULL_NAME_FIELD]: 'workflow',
              [STATUS]: 'Draft',
            },
            mockTypes.Workflow,
          ),
        })
        expect(workflowChange).not.toSatisfy(isDeactivatedFlowChangeOnly)
      })
    })
  })
  describe('referenceFieldTargetTypes', () => {
    const fieldParent = createCustomObjectType('SomeCustomObject', {})
    let field: Field
    let referenceTargets: string[]

    describe('when there is no annotation', () => {
      beforeEach(() => {
        field = createField(
          fieldParent,
          Types.primitiveDataTypes.Lookup,
          'SomeCustomObject.SomeField',
        )
        referenceTargets = referenceFieldTargetTypes(field)
      })
      it('should return an empty array', () => {
        expect(referenceTargets).toBeArrayOfSize(0)
      })
    })
    describe('when the annotation is empty', () => {
      beforeEach(() => {
        field = createField(
          fieldParent,
          Types.primitiveDataTypes.MasterDetail,
          'SomeCustomObject.SomeField',
          {
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [],
          },
        )
        referenceTargets = referenceFieldTargetTypes(field)
      })
      it('should return an empty array', () => {
        expect(referenceTargets).toBeArrayOfSize(0)
      })
    })
    describe('when the annotation contains strings', () => {
      beforeEach(() => {
        field = createField(
          fieldParent,
          Types.primitiveDataTypes.Lookup,
          'SomeCustomObject.SomeField',
          {
            [FIELD_ANNOTATIONS.REFERENCE_TO]: ['SomeTargetType'],
          },
        )
        referenceTargets = referenceFieldTargetTypes(field)
      })
      it('should return the referred type', () => {
        expect(referenceTargets).toBeArrayOfSize(1)
        expect(referenceTargets).toContainValue('SomeTargetType')
      })
    })
    describe('when the annotation contains references', () => {
      beforeEach(() => {
        const targetType = createCustomObjectType('TargetType', {})
        field = createField(
          fieldParent,
          Types.primitiveDataTypes.MasterDetail,
          'SomeCustomObject.SomeField',
          {
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [
              new ReferenceExpression(targetType.elemID, targetType),
            ],
          },
        )
        referenceTargets = referenceFieldTargetTypes(field)
      })
      it('should return the referred type name', () => {
        expect(referenceTargets).toBeArrayOfSize(1)
        expect(referenceTargets).toContainValue('TargetType')
      })
    })
    describe('when it`s a hierarchy field', () => {
      beforeEach(() => {
        field = createField(
          fieldParent,
          Types.primitiveDataTypes.Hierarchy,
          'SomeCustomObject.SomeField',
        )
        referenceTargets = referenceFieldTargetTypes(field)
      })
      it('should return the referred type name', () => {
        expect(referenceTargets).toBeArrayOfSize(1)
        expect(referenceTargets).toContainValue('SomeCustomObject')
      })
    })
  })
  describe('isStandardField', () => {
    it('should return true for Standard Field', () => {
      expect(mockTypes.Account.fields.Name).toSatisfy(isStandardField)
    })
    it('should return false for Custom Field', () => {
      const customField = new Field(
        mockTypes.Account,
        'CustomField__c',
        Types.primitiveDataTypes.Text,
        {
          [API_NAME]: 'Account.CustomField__c',
        },
      )
      expect(customField).not.toSatisfy(isStandardField)
    })
  })
  describe('getFullName', () => {
    it('should return correct fullNames', () => {
      // instances with no parent
      expect(
        getFullName(
          mockFileProperties({ fullName: 'Test', type: 'ApexClass' }),
        ),
      ).toEqual('Test')
      expect(
        getFullName(
          mockFileProperties({
            fullName: 'Test',
            namespacePrefix: 'test',
            type: 'ApexClass',
          }),
        ),
      ).toEqual('test__Test')
      expect(
        getFullName(
          mockFileProperties({
            fullName: 'test__Test',
            namespacePrefix: 'test',
            type: 'ApexClass',
          }),
        ),
      ).toEqual('test__Test')
      expect(
        getFullName(
          mockFileProperties({
            fullName: 'Test',
            namespacePrefix: 'test',
            type: 'ApexClass',
          }),
          false,
        ),
      ).toEqual('Test')
      // layout instances
      expect(
        getFullName(
          mockFileProperties({ fullName: 'Test-Test', type: 'Layout' }),
        ),
      ).toEqual('Test-Test')
      expect(
        getFullName(
          mockFileProperties({
            fullName: 'Test-Test',
            namespacePrefix: 'test',
            type: 'Layout',
          }),
        ),
      ).toEqual('Test-test__Test')
      expect(
        getFullName(
          mockFileProperties({
            fullName: 'Test-test__Test',
            namespacePrefix: 'test',
            type: 'Layout',
          }),
        ),
      ).toEqual('Test-test__Test')
      expect(
        getFullName(
          mockFileProperties({
            fullName: 'Test-Test',
            namespacePrefix: 'test',
            type: 'Layout',
          }),
          false,
        ),
      ).toEqual('Test-test__Test')
      // instances with parent
      expect(
        getFullName(
          mockFileProperties({
            fullName: 'Parent.Test',
            type: 'ValidationRule',
          }),
        ),
      ).toEqual('Parent.Test')
      expect(
        getFullName(
          mockFileProperties({
            fullName: 'Parent.Test',
            namespacePrefix: 'test',
            type: 'ValidationRule',
          }),
        ),
      ).toEqual('Parent.test__Test')
      expect(
        getFullName(
          mockFileProperties({
            fullName: 'Parent.test__Test',
            namespacePrefix: 'test',
            type: 'ValidationRule',
          }),
        ),
      ).toEqual('Parent.test__Test')
      expect(
        getFullName(
          mockFileProperties({
            fullName: 'Parent.Test',
            namespacePrefix: 'test',
            type: 'ValidationRule',
          }),
          false,
        ),
      ).toEqual('Parent.Test')
      expect(
        getFullName(
          mockFileProperties({
            fullName: 'Parent.Test',
            namespacePrefix: 'test',
            type: 'ValidationRule',
          }),
          false,
        ),
      ).toEqual('Parent.Test')
    })
  })
  describe('isInstanceOfCustomObjectSync', () => {
    it('should return true for CustomObject instance', () => {
      const instance = new InstanceElement('TestInstance', mockTypes.Account, {
        Name: 'TestInstance',
      })
      expect(instance).toSatisfy(isInstanceOfCustomObjectSync)
    })
    it('should return false for non CustomObject instance', () => {
      expect(mockInstances().Profile).not.toSatisfy(
        isInstanceOfCustomObjectSync,
      )
    })
  })
  describe('isInstanceOfCustomObjectChangeSync', () => {
    it('should return true for CustomObject instance', () => {
      const instance = new InstanceElement('TestInstance', mockTypes.Account, {
        Name: 'TestInstance',
      })
      expect(toChange({ after: instance })).toSatisfy(
        isInstanceOfCustomObjectChangeSync,
      )
    })
    it('should return false for non CustomObject instance', () => {
      expect(toChange({ after: mockInstances().Profile })).not.toSatisfy(
        isInstanceOfCustomObjectChangeSync,
      )
    })
  })
  describe('aliasOrElemID', () => {
    it('should return the alias for Element with alias', () => {
      const instanceWithAlias = mockInstances().Profile.clone()
      instanceWithAlias.annotations[CORE_ANNOTATIONS.ALIAS] = 'Test Alias'
      expect(aliasOrElemID(instanceWithAlias)).toEqual('Test Alias')
    })
    it('should return the fullElemID for Element without alias', () => {
      const instanceWithoutAlias = mockInstances().Profile
      expect(aliasOrElemID(instanceWithoutAlias)).toEqual(
        instanceWithoutAlias.elemID.getFullName(),
      )
    })
  })
  describe('getMostRecentFileProperties', () => {
    it('should return the most recent file properties', () => {
      const mostRecentProps = mockFileProperties({
        type: CUSTOM_OBJECT,
        fullName: 'Test3__c',
        lastModifiedDate: '2023-11-03T16:28:30.000Z',
      })
      const fileProperties = [
        mockFileProperties({
          type: CUSTOM_OBJECT,
          fullName: 'Test__c',
          lastModifiedDate: '2023-11-01T16:28:30.000Z',
        }),
        mockFileProperties({
          type: CUSTOM_OBJECT,
          fullName: 'Test2__c',
          lastModifiedDate: '2023-11-02T16:28:30.000Z',
        }),
      ].concat(mostRecentProps)
      expect(getMostRecentFileProperties(fileProperties)).toEqual(
        mostRecentProps,
      )
    })
    it('should return undefined for empty array', () => {
      expect(getMostRecentFileProperties([])).toBeUndefined()
    })
    it('should return undefined if all fileProps are with undefined empty, or unix time zero lastModifiedDate', () => {
      const fileProperties = [
        mockFileProperties({
          type: CUSTOM_OBJECT,
          fullName: 'Test__c',
          lastModifiedDate: undefined,
        }),
        mockFileProperties({
          type: CUSTOM_OBJECT,
          fullName: 'Test2__c',
          lastModifiedDate: '',
        }),
        mockFileProperties({
          type: CUSTOM_OBJECT,
          fullName: 'Test2__c',
          lastModifiedDate: UNIX_TIME_ZERO_STRING,
        }),
      ]
      expect(getMostRecentFileProperties(fileProperties)).toBeUndefined()
    })
  })
  describe('getFLSProfiles', () => {
    it('should return the default FLS Profiles when flsProfiles are undefined in the config', () => {
      expect(getFLSProfiles({})).toEqual(DEFAULT_FLS_PROFILES)
    })

    it('should return the FLS profiles defined in the config', () => {
      const flsProfiles = ['Admin Copy', 'Test Profile']
      expect(getFLSProfiles({ client: { deploy: { flsProfiles } } })).toEqual(
        flsProfiles,
      )
    })
  })
  describe('toCustomField', () => {
    const elemID = new ElemID('salesforce', 'test')
    const field = new Field(
      new ObjectType({ elemID }),
      'name',
      Types.primitiveDataTypes.Text,
      { [LABEL]: 'Labelo' },
    )

    it('should have label for custom field', async () => {
      field.annotations[API_NAME] = 'Test__c.Custom__c'
      const customField = await toCustomField(field)
      expect(customField.label).toEqual('Labelo')
    })
    it('should convert geolocation type to location', async () => {
      field.refType = createRefToElmWithValue(Types.compoundDataTypes.Location)
      const customField = await toCustomField(field)
      expect(customField.type).toEqual('Location')
    })

    it('should remove internalId', async () => {
      field.annotations[INTERNAL_ID_ANNOTATION] = 'internal id'
      const customField = await toCustomField(field)
      expect(customField).not.toHaveProperty(INTERNAL_ID_ANNOTATION)
    })
    describe('Hierarchy CustomField', () => {
      it('should have relationshipName value but no relatesTo value', async () => {
        const customField = await toCustomField(
          mockTypes.User.fields.Manager__c,
        )
        expect(customField.relationshipName).toEqual('Manager')
        expect(customField.referenceTo).toBeUndefined()
      })
    })
    describe('MetadataRelationship CustomField', () => {
      const CONTROLLING_FIELD = 'TestControllingField__c'
      it('should have controlling field value', async () => {
        const metadataRelationshipField = new Field(
          new ObjectType({ elemID }),
          'RelationshipField',
          Types.primitiveDataTypes.MetadataRelationship,
          {
            [LABEL]: 'Labelo',
            [FIELD_ANNOTATIONS.METADATA_RELATIONSHIP_CONTROLLING_FIELD]:
              CONTROLLING_FIELD,
          },
        )
        const customField = await toCustomField(metadataRelationshipField)
        expect(
          customField[
            FIELD_ANNOTATIONS.METADATA_RELATIONSHIP_CONTROLLING_FIELD
          ],
        ).toEqual(CONTROLLING_FIELD)
      })
    })
  })

  describe('await toCustomProperties', () => {
    const elemID = new ElemID('salesforce', 'test')

    describe('annotations transformation', () => {
      const notInAnnotationTypes = 'notInAnnotationTypes'
      const objType = new ObjectType({
        elemID,
        annotationRefsOrTypes: {
          [API_NAME]: BuiltinTypes.SERVICE_ID,
          [METADATA_TYPE]: BuiltinTypes.STRING,
          [DESCRIPTION]: BuiltinTypes.STRING,
        },
        annotations: {
          [API_NAME]: 'Test__c',
          [notInAnnotationTypes]: 'Dummy',
          [METADATA_TYPE]: CUSTOM_OBJECT,
          [DESCRIPTION]: 'MyDescription',
        },
      })

      let customObj: CustomObject
      beforeEach(async () => {
        customObj = await toCustomProperties(objType, false)
      })

      it('should transform annotations', () => {
        expect(_.get(customObj, DESCRIPTION)).toEqual('MyDescription')
      })

      it('should not transform skipped annotations', () => {
        expect(_.get(customObj, API_NAME)).toBeUndefined()
        expect(_.get(customObj, METADATA_TYPE)).toBeUndefined()
      })

      it('should not transform annotations that are not in annotationTypes', () => {
        expect(_.get(customObj, notInAnnotationTypes)).toBeUndefined()
      })
    })

    describe('standard field transformation', () => {
      const ignoredField = 'ignored'
      const existingField = 'test'
      const objType = new ObjectType({
        elemID,
        fields: {
          [existingField]: {
            refType: Types.primitiveDataTypes.Text,
            annotations: { [API_NAME]: 'Test__c' },
          },
          [ignoredField]: {
            refType: Types.primitiveDataTypes.Text,
            annotations: { [API_NAME]: 'Ignored__c' },
          },
        },
        annotations: {
          [API_NAME]: 'Test__c',
          [METADATA_TYPE]: CUSTOM_OBJECT,
        },
      })

      describe('with fields', () => {
        let customObj: CustomObject
        beforeEach(async () => {
          customObj = await toCustomProperties(objType, true, [
            objType.fields[ignoredField].annotations[API_NAME],
          ])
        })
        it('should have correct name', () => {
          expect(customObj.fullName).toEqual(objType.annotations[API_NAME])
        })
        it('should have fields', () => {
          expect(customObj.fields).toBeDefined()
          expect(
            makeArray(customObj.fields).map((f) => f.fullName),
          ).toContainEqual(objType.fields[existingField].annotations[API_NAME])
        })
        it('should not have ignored fields', () => {
          expect(
            makeArray(customObj.fields).map((f) => f.fullName),
          ).not.toContainEqual(
            objType.fields[ignoredField].annotations[API_NAME],
          )
        })
      })

      describe('without fields', () => {
        let customObj: CustomObject
        beforeEach(async () => {
          customObj = await toCustomProperties(objType, false)
        })
        it('should not contain fields', () => {
          expect(customObj.fields).toBeUndefined()
        })
      })

      describe('create a custom settings object', () => {
        let customObj: CustomObject
        beforeEach(async () => {
          const customSettingsObj = new ObjectType({
            elemID,
            annotationRefsOrTypes: {
              [API_NAME]: BuiltinTypes.SERVICE_ID,
              [METADATA_TYPE]: BuiltinTypes.STRING,
              [DESCRIPTION]: BuiltinTypes.STRING,
              [CUSTOM_SETTINGS_TYPE]: BuiltinTypes.STRING,
            },
            annotations: {
              [API_NAME]: 'Test__c',
              [METADATA_TYPE]: CUSTOM_OBJECT,
              [DESCRIPTION]: 'MyDescription',
              [CUSTOM_SETTINGS_TYPE]: 'Hierarchical',
            },
          })
          customObj = await toCustomProperties(customSettingsObj, false)
        })
        it("should not create fields that don't exist on custom settings objects", () => {
          expect(customObj).not.toHaveProperty('pluralLabel')
          expect(customObj).not.toHaveProperty('sharingModel')
        })
      })
    })

    describe('reference field transformation', () => {
      const relatedTo = ['User', 'Property__c']
      const relationshipName = 'relationship_name'
      const annotations: Values = {
        [API_NAME]: COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME,
        [LABEL]: 'field_label',
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [FIELD_ANNOTATIONS.REFERENCE_TO]: relatedTo,
        [FIELD_ANNOTATIONS.RELATIONSHIP_NAME]: relationshipName,
      }
      const fieldName = COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME
      const origObjectType = new ObjectType({
        elemID,
        fields: {
          [fieldName]: {
            refType: Types.primitiveDataTypes.Lookup,
            annotations,
          },
        },
      })
      let objectType: ObjectType
      beforeEach(() => {
        objectType = origObjectType.clone()
      })

      const assertCustomFieldTransformation = (
        customField: CustomField,
        expectedType: string,
        expectedRelationshipName: string,
        expectedDeleteConstraint: string | undefined,
        expectedReferenceTo: string[],
      ): void => {
        expect(customField.type).toEqual(expectedType)
        expect(customField.relationshipName).toEqual(expectedRelationshipName)
        expect(customField.deleteConstraint).toEqual(expectedDeleteConstraint)
        expect(customField.referenceTo).toEqual(expectedReferenceTo)
      }

      it('should transform master-detail field', async () => {
        const masterDetailField = objectType.fields[fieldName]
        masterDetailField.refType = createRefToElmWithValue(
          Types.primitiveDataTypes.MasterDetail,
        )
        masterDetailField.annotations[
          FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ
        ] = true
        masterDetailField.annotations[
          FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL
        ] = true
        const customMasterDetailField = await toCustomField(masterDetailField)
        assertCustomFieldTransformation(
          customMasterDetailField,
          FIELD_TYPE_NAMES.MASTER_DETAIL,
          relationshipName,
          undefined,
          relatedTo,
        )
        expect(customMasterDetailField.reparentableMasterDetail).toBe(true)
        expect(customMasterDetailField.writeRequiresMasterRead).toBe(true)
      })
    })

    describe('field dependency transformation', () => {
      const annotations: Values = {
        [API_NAME]: 'field_name',
        [LABEL]: 'field_label',
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [FIELD_ANNOTATIONS.VALUE_SET]: [
          createValueSetEntry('Val1'),
          createValueSetEntry('Val2', false, 'Val2', true, '#FFFF00'),
        ],
        [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: {
          [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: 'ControllingFieldName',
          [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [
            {
              [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: [
                'ControllingVal1',
              ],
              [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'Val1',
            },
            {
              [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: [
                'ControllingVal1',
                'ControllingVal2',
              ],
              [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'Val2',
            },
          ],
        },
      }
      const fieldName = 'field_name'
      const origObjectType = new ObjectType({
        elemID,
        fields: {
          [fieldName]: {
            refType: Types.primitiveDataTypes.Picklist,
            annotations,
          },
        },
      })
      let obj: ObjectType
      beforeEach(() => {
        obj = origObjectType.clone()
      })

      it('should transform value set for picklist field', async () => {
        const picklistField = await toCustomField(obj.fields[fieldName])
        expect(picklistField.type).toEqual(FIELD_TYPE_NAMES.PICKLIST)
        expect(picklistField?.valueSet?.valueSetDefinition?.value).toEqual([
          new CustomPicklistValue('Val1', false, true),
          new CustomPicklistValue('Val2', false, true, 'Val2', '#FFFF00'),
        ])
      })

      it('should transform field dependency for picklist field', async () => {
        const customFieldWithFieldDependency = await toCustomField(
          obj.fields[fieldName],
        )
        expect(customFieldWithFieldDependency.type).toEqual(
          FIELD_TYPE_NAMES.PICKLIST,
        )
        expect(
          customFieldWithFieldDependency?.valueSet?.controllingField,
        ).toEqual('ControllingFieldName')
        const valueSettings =
          customFieldWithFieldDependency?.valueSet?.valueSettings
        expect(valueSettings).toHaveLength(2)
        expect(valueSettings?.[0].valueName).toEqual('Val1')
        expect(valueSettings?.[0].controllingFieldValue).toEqual([
          'ControllingVal1',
        ])
        expect(valueSettings?.[1].valueName).toEqual('Val2')
        expect(valueSettings?.[1].controllingFieldValue).toEqual([
          'ControllingVal1',
          'ControllingVal2',
        ])
      })

      it('should transform field dependency for multi picklist field', async () => {
        obj.fields[fieldName].refType = createRefToElmWithValue(
          Types.primitiveDataTypes.MultiselectPicklist,
        )
        const customFieldWithFieldDependency = await toCustomField(
          obj.fields[fieldName],
        )
        expect(customFieldWithFieldDependency.type).toEqual(
          FIELD_TYPE_NAMES.MULTIPICKLIST,
        )
        expect(
          customFieldWithFieldDependency?.valueSet?.controllingField,
        ).toEqual('ControllingFieldName')
        const valueSettings =
          customFieldWithFieldDependency?.valueSet?.valueSettings
        expect(valueSettings).toHaveLength(2)
        expect(valueSettings?.[0].valueName).toEqual('Val1')
        expect(valueSettings?.[0].controllingFieldValue).toEqual([
          'ControllingVal1',
        ])
        expect(valueSettings?.[1].valueName).toEqual('Val2')
        expect(valueSettings?.[1].controllingFieldValue).toEqual([
          'ControllingVal1',
          'ControllingVal2',
        ])
      })

      it('should ignore field dependency when not defined', async () => {
        delete obj.fields[fieldName].annotations[
          FIELD_ANNOTATIONS.FIELD_DEPENDENCY
        ]
        const customFieldWithFieldDependency = await toCustomField(
          obj.fields[fieldName],
        )
        expect(customFieldWithFieldDependency.type).toEqual(
          FIELD_TYPE_NAMES.PICKLIST,
        )
        expect(
          customFieldWithFieldDependency?.valueSet?.controllingField,
        ).toBeUndefined()
        expect(
          customFieldWithFieldDependency?.valueSet?.valueSettings,
        ).toBeUndefined()
      })
    })

    describe('global picklist transformation', () => {
      const annotations: Values = {
        [API_NAME]: 'field_name',
        [LABEL]: 'field_label',
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [VALUE_SET_FIELDS.VALUE_SET_NAME]: 'gvs',
      }
      const fieldName = 'field_name'
      const origObjectType = new ObjectType({
        elemID,
        fields: {
          [fieldName]: {
            refType: Types.primitiveDataTypes.Picklist,
            annotations,
          },
        },
      })
      let obj: ObjectType
      beforeEach(() => {
        obj = origObjectType.clone()
      })

      it('should transform global picklist field', async () => {
        const customFieldWithGlobalPicklist = await toCustomField(
          obj.fields[fieldName],
        )
        expect(customFieldWithGlobalPicklist.type).toEqual(
          FIELD_TYPE_NAMES.PICKLIST,
        )
        expect(customFieldWithGlobalPicklist?.valueSet?.valueSetName).toEqual(
          'gvs',
        )
        expect(customFieldWithGlobalPicklist?.valueSet?.restricted).toBe(true)
      })
    })

    describe('rollup summary field transformation', () => {
      const annotations: Values = {
        [API_NAME]: 'field_name',
        [LABEL]: 'field_label',
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [FIELD_ANNOTATIONS.SUMMARY_OPERATION]: 'count',
        [FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]: 'Opportunity.AccountId',
        [FIELD_ANNOTATIONS.SUMMARIZED_FIELD]: 'Opportunity.Amount',
        [FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: [
          {
            [FILTER_ITEM_FIELDS.FIELD]: 'FieldName1',
            [FILTER_ITEM_FIELDS.OPERATION]: 'equals',
            [FILTER_ITEM_FIELDS.VALUE]: 'val1',
          },
          {
            [FILTER_ITEM_FIELDS.FIELD]: 'FieldName2',
            [FILTER_ITEM_FIELDS.OPERATION]: 'equals',
            [FILTER_ITEM_FIELDS.VALUE]: 'val2',
          },
        ],
      }
      const fieldName = 'field_name'
      const origObjectType = new ObjectType({
        elemID,
        fields: {
          [fieldName]: {
            refType: Types.primitiveDataTypes.Summary,
            annotations,
          },
        },
      })
      let obj: ObjectType
      beforeEach(() => {
        obj = _.clone(origObjectType)
      })

      it('should transform rollup summary field', async () => {
        const rollupSummaryInfo = await toCustomField(obj.fields[fieldName])
        expect(rollupSummaryInfo.type).toEqual(FIELD_TYPE_NAMES.ROLLUP_SUMMARY)
        expect(_.get(rollupSummaryInfo, 'summarizedField')).toEqual(
          'Opportunity.Amount',
        )
        expect(_.get(rollupSummaryInfo, 'summaryForeignKey')).toEqual(
          'Opportunity.AccountId',
        )
        expect(_.get(rollupSummaryInfo, 'summaryOperation')).toEqual('count')
        expect(rollupSummaryInfo.summaryFilterItems).toBeDefined()
        const filterItems = rollupSummaryInfo.summaryFilterItems as FilterItem[]
        expect(filterItems).toHaveLength(2)
        expect(filterItems[0].field).toEqual('FieldName1')
        expect(filterItems[0].operation).toEqual('equals')
        expect(filterItems[0].value).toEqual('val1')
        expect(filterItems[1].field).toEqual('FieldName2')
        expect(filterItems[1].operation).toEqual('equals')
        expect(filterItems[1].value).toEqual('val2')
      })

      it('should ignore field dependency when not defined', async () => {
        delete obj.fields[fieldName].annotations[
          FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS
        ]
        const rollupSummaryInfo = await toCustomField(obj.fields[fieldName])
        expect(rollupSummaryInfo.type).toEqual(FIELD_TYPE_NAMES.ROLLUP_SUMMARY)
        expect(_.get(rollupSummaryInfo, 'summarizedField')).toEqual(
          'Opportunity.Amount',
        )
        expect(_.get(rollupSummaryInfo, 'summaryForeignKey')).toEqual(
          'Opportunity.AccountId',
        )
        expect(_.get(rollupSummaryInfo, 'summaryOperation')).toEqual('count')
        expect(rollupSummaryInfo.summaryFilterItems).toBeUndefined()
      })
    })
  })
})
