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
import _ from 'lodash'
import {
  ObjectType, ElemID, Field, BuiltinTypes, TypeElement, Field as TypeField, Values,
  CORE_ANNOTATIONS, ReferenceExpression, InstanceElement, getRestriction, ListType,
  createRestriction,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { Field as SalesforceField } from 'jsforce'
import {
  restoreValues, resolveValues,
} from '@salto-io/adapter-utils'
import {
  getSObjectFieldElement, Types, toCustomField, toCustomProperties, instancesToUpdateRecords,
  getValueTypeFieldElement, createMetadataTypeElements, MetadataObjectType,
  METADATA_TYPES_TO_RENAME, instancesToDeleteRecords, instancesToCreateRecords,
  isMetadataObjectType, isMetadataInstanceElement, toDeployableInstance, transformPrimitive,
} from '../../src/transformers/transformer'
import { getLookUpName } from '../../src/transformers/reference_mapping'
import {
  FIELD_ANNOTATIONS, FIELD_TYPE_NAMES, LABEL, API_NAME, COMPOUND_FIELD_TYPE_NAMES,
  FIELD_DEPENDENCY_FIELDS, VALUE_SETTINGS_FIELDS, FILTER_ITEM_FIELDS, METADATA_TYPE,
  CUSTOM_OBJECT, VALUE_SET_FIELDS, SUBTYPES_PATH, INSTANCE_FULL_NAME_FIELD, DESCRIPTION,
  SALESFORCE, WORKFLOW_FIELD_UPDATE_METADATA_TYPE, CUSTOM_SETTINGS_TYPE,
  WORKFLOW_RULE_METADATA_TYPE, WORKFLOW_ACTION_REFERENCE_METADATA_TYPE, INTERNAL_ID_FIELD,
  WORKFLOW_ACTION_ALERT_METADATA_TYPE, LAYOUT_TYPE_ID_METADATA_TYPE, CPQ_PRODUCT_RULE,
  CPQ_LOOKUP_PRODUCT_FIELD, INTERNAL_ID_ANNOTATION, BUSINESS_HOURS_METADATA_TYPE,
} from '../../src/constants'
import { CustomField, FilterItem, CustomObject, CustomPicklistValue,
  SalesforceRecord } from '../../src/client/types'
import SalesforceClient from '../../src/client/client'
import Connection from '../../src/client/jsforce'
import mockClient from '../client'
import { createValueSetEntry, MockInterface } from '../utils'
import { LAYOUT_TYPE_ID } from '../../src/filters/layouts'
import { mockValueTypeField, mockDescribeValueResult } from '../connection'
import { allMissingSubTypes } from '../../src/transformers/salesforce_types'
import { convertRawMissingFields } from '../../src/transformers/missing_fields'


const { makeArray } = collections.array

describe('transformer', () => {
  describe('getValueTypeFieldElement', () => {
    const dummyElem = new ObjectType({ elemID: new ElemID('adapter', 'dummy') })
    const salesforceEnumField = mockValueTypeField({
      name: 'Field',
      soapType: 'String',
      picklistValues: [
        { active: true, defaultValue: false, value: 'b' },
        { active: true, defaultValue: false, value: 'a' },
        { active: true, defaultValue: false, value: 'a' },
      ],
    })
    describe('enum field', () => {
      let enumField: TypeField
      beforeEach(() => {
        enumField = getValueTypeFieldElement(dummyElem, salesforceEnumField, new Map())
      })
      describe('restriction values', () => {
        it('should not have duplicate values', () => {
          expect(getRestriction(enumField).values).toHaveLength(2)
        })
        it('should be sorted alphabetically', () => {
          expect(getRestriction(enumField).values).toEqual(['a', 'b'])
        })
      })
    })
  })
  describe('getSObjectFieldElement', () => {
    const dummyElem = new ObjectType({ elemID: new ElemID('adapter', 'dummy') })
    const serviceIds = { [API_NAME]: 'Dummy' }
    describe('reference field transformation', () => {
      const origSalesforceReferenceField: SalesforceField = {
        aggregatable: false,
        cascadeDelete: false,
        dependentPicklist: false,
        externalId: false,
        htmlFormatted: false,
        autoNumber: false,
        byteLength: 18,
        calculated: false,
        caseSensitive: false,
        createable: true,
        custom: false,
        defaultedOnCreate: true,
        deprecatedAndHidden: false,
        digits: 0,
        filterable: true,
        groupable: true,
        idLookup: false,
        label: 'Owner ID',
        length: 18,
        name: 'OwnerId',
        nameField: false,
        namePointing: true,
        nillable: false,
        permissionable: false,
        polymorphicForeignKey: true,
        precision: 0,
        queryByDistance: false,
        referenceTo: [
          'Group',
          'User',
        ],
        relationshipName: 'Owner',
        restrictedPicklist: false,
        scale: 0,
        searchPrefilterable: false,
        soapType: 'tns:ID',
        sortable: true,
        type: 'reference',
        unique: false,
        updateable: true,
      }

      let salesforceReferenceField: SalesforceField
      beforeEach(() => {
        salesforceReferenceField = _.cloneDeep(origSalesforceReferenceField)
      })

      const assertReferenceFieldTransformation = (
        fieldElement: Field,
        expectedRelatedTo: string[],
        expectedType: TypeElement,
      ): void => {
        expect(fieldElement.type).toEqual(expectedType)
        expect(fieldElement.name).toEqual('OwnerId')
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.REFERENCE_TO])
          .toHaveLength(expectedRelatedTo.length)
        expectedRelatedTo.forEach(expectedRelatedToValue =>
          expect(fieldElement.annotations[FIELD_ANNOTATIONS.REFERENCE_TO])
            .toContain(expectedRelatedToValue))
      }

      it('should fetch lookup relationships with restricted deletion', async () => {
        _.set(salesforceReferenceField, 'restrictedDelete', true)
        const fieldElement = getSObjectFieldElement(dummyElem, salesforceReferenceField,
          serviceIds)
        assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.primitiveDataTypes.Lookup)
      })

      it('should fetch lookup relationships with allowed related record deletion when restrictedDelete set to false', async () => {
        _.set(salesforceReferenceField, 'restrictedDelete', false)
        const fieldElement = getSObjectFieldElement(dummyElem, salesforceReferenceField,
          serviceIds)
        assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.primitiveDataTypes.Lookup)
      })

      it('should fetch lookup relationships with allowed related record deletion when restrictedDelete is undefined', async () => {
        _.set(salesforceReferenceField, 'restrictedDelete', undefined)
        const fieldElement = getSObjectFieldElement(dummyElem, salesforceReferenceField,
          serviceIds)
        assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.primitiveDataTypes.Lookup)
      })

      it('should fetch masterdetail relationships', async () => {
        salesforceReferenceField.cascadeDelete = true
        salesforceReferenceField.updateable = true
        salesforceReferenceField.writeRequiresMasterRead = true
        const fieldElement = getSObjectFieldElement(dummyElem, salesforceReferenceField,
          serviceIds)
        assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.primitiveDataTypes.MasterDetail)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]).toBe(true)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]).toBe(true)
      })

      it('should fetch masterdetail relationships which are not reparentable and requires read/write access', async () => {
        salesforceReferenceField.cascadeDelete = true
        salesforceReferenceField.updateable = false
        delete salesforceReferenceField.writeRequiresMasterRead
        const fieldElement = getSObjectFieldElement(dummyElem, salesforceReferenceField, {})
        assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.primitiveDataTypes.MasterDetail)
        expect(fieldElement.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]).toBe(false)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]).toBe(false)
      })
    })

    describe('rollup summary field transformation', () => {
      const origRollupSummaryField: SalesforceField = {
        aggregatable: false,
        cascadeDelete: false,
        dependentPicklist: false,
        externalId: false,
        htmlFormatted: false,
        autoNumber: false,
        byteLength: 18,
        calculated: true,
        caseSensitive: false,
        createable: true,
        custom: false,
        defaultedOnCreate: true,
        deprecatedAndHidden: false,
        digits: 0,
        filterable: true,
        groupable: true,
        idLookup: false,
        label: 'Owner ID',
        length: 18,
        name: 'OwnerId',
        nameField: false,
        namePointing: true,
        nillable: false,
        permissionable: false,
        polymorphicForeignKey: true,
        precision: 0,
        queryByDistance: false,
        relationshipName: 'Owner',
        restrictedPicklist: false,
        scale: 0,
        searchPrefilterable: false,
        soapType: 'xsd:double',
        sortable: true,
        type: 'currency',
        unique: false,
        updateable: true,
      }

      let salesforceRollupSummaryField: SalesforceField
      beforeEach(() => {
        salesforceRollupSummaryField = _.cloneDeep(origRollupSummaryField)
      })

      it('should fetch rollup summary field', async () => {
        const fieldElement = getSObjectFieldElement(dummyElem, salesforceRollupSummaryField,
          serviceIds)
        expect(fieldElement.type).toEqual(Types.primitiveDataTypes.Summary)
      })

      it('should not fetch summary field if it is a calculated formula', async () => {
        salesforceRollupSummaryField.calculatedFormula = 'dummy formula'
        const fieldElement = getSObjectFieldElement(dummyElem, salesforceRollupSummaryField,
          serviceIds)
        expect(fieldElement.type).not.toEqual(Types.primitiveDataTypes.Summary)
      })
    })

    describe('number field transformation', () => {
      const origNumberField: SalesforceField = {
        aggregatable: true,
        cascadeDelete: false,
        dependentPicklist: false,
        externalId: false,
        htmlFormatted: false,
        autoNumber: false,
        byteLength: 0,
        calculated: false,
        caseSensitive: false,
        createable: true,
        custom: true,
        defaultedOnCreate: false,
        deprecatedAndHidden: false,
        digits: 0,
        filterable: true,
        groupable: false,
        idLookup: false,
        label: 'yooo',
        length: 0,
        name: 'yooo__c',
        nameField: false,
        namePointing: false,
        nillable: true,
        permissionable: true,
        polymorphicForeignKey: false,
        precision: 8,
        queryByDistance: false,
        restrictedPicklist: false,
        scale: 5,
        searchPrefilterable: false,
        soapType: 'xsd:double',
        sortable: true,
        type: 'double',
        unique: false,
        updateable: true,
      }

      let salesforceNumberField: SalesforceField
      beforeEach(() => {
        salesforceNumberField = _.cloneDeep(origNumberField)
      })

      it('should fetch double field and init its annotations', async () => {
        const precision = 9
        const scale = 6
        salesforceNumberField.precision = precision
        salesforceNumberField.scale = scale
        const fieldElement = getSObjectFieldElement(dummyElem, salesforceNumberField, serviceIds)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.PRECISION]).toEqual(precision)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.SCALE]).toEqual(scale)
        expect(fieldElement.type).toEqual(Types.primitiveDataTypes.Number)
      })

      it('should fetch int field and init its annotations', async () => {
        const precision = 8
        salesforceNumberField.type = 'int'
        salesforceNumberField.digits = precision
        const fieldElement = getSObjectFieldElement(dummyElem, salesforceNumberField, serviceIds)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.PRECISION]).toEqual(precision)
        expect(fieldElement.type).toEqual(Types.primitiveDataTypes.Number)
      })
    })

    describe('address (compound) field transformation', () => {
      const origSalesforceAddressField: SalesforceField = {
        aggregatable: true,
        cascadeDelete: false,
        dependentPicklist: false,
        externalId: false,
        htmlFormatted: false,
        autoNumber: false,
        byteLength: 363,
        calculated: false,
        caseSensitive: false,
        createable: false,
        custom: false,
        defaultedOnCreate: false,
        deprecatedAndHidden: false,
        digits: 0,
        filterable: true,
        groupable: true,
        idLookup: false,
        label: 'Other Address',
        length: 121,
        name: 'OtherAddress',
        nameField: false,
        namePointing: false,
        nillable: false,
        permissionable: false,
        polymorphicForeignKey: false,
        precision: 0,
        queryByDistance: false,
        restrictedPicklist: false,
        scale: 0,
        searchPrefilterable: false,
        soapType: 'xsd:string',
        sortable: true,
        type: 'address',
        unique: false,
        updateable: false,
      }

      let salesforceAddressField: SalesforceField
      beforeEach(() => {
        salesforceAddressField = _.cloneDeep(origSalesforceAddressField)
      })

      it('should fetch address field with the object type when object has it as compound field', async () => {
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceAddressField,
          serviceIds,
          { OtherAddress: 'OtherAddress' }
        )
        expect(fieldElement.type).toEqual(Types.compoundDataTypes.Address)
      })
    })

    describe('id field transformation', () => {
      const origSalesforceIdField: SalesforceField = {
        aggregatable: true,
        cascadeDelete: false,
        dependentPicklist: false,
        externalId: false,
        htmlFormatted: false,
        autoNumber: false,
        byteLength: 18,
        calculated: false,
        caseSensitive: false,
        createable: false,
        custom: false,
        defaultedOnCreate: true,
        deprecatedAndHidden: false,
        digits: 0,
        filterable: true,
        groupable: true,
        idLookup: true,
        label: 'Record Id',
        length: 18,
        name: 'Id',
        nameField: false,
        namePointing: false,
        nillable: false,
        permissionable: false,
        polymorphicForeignKey: false,
        precision: 0,
        queryByDistance: false,
        restrictedPicklist: false,
        scale: 0,
        searchPrefilterable: false,
        soapType: 'tns:ID',
        sortable: true,
        type: 'id',
        unique: false,
        updateable: false,
      }

      let salesforceIdField: SalesforceField
      it('should fetch idLookup & typed id fields as serviceId', () => {
        salesforceIdField = _.cloneDeep(origSalesforceIdField)
        const fieldElement = getSObjectFieldElement(dummyElem, salesforceIdField,
          serviceIds, {})
        expect(fieldElement.type).toEqual(BuiltinTypes.SERVICE_ID)
      })
    })

    describe('autoNumber field transformation', () => {
      const origSalesforceAutonumberField: SalesforceField = {
        aggregatable: true,
        cascadeDelete: false,
        dependentPicklist: false,
        externalId: false,
        htmlFormatted: false,
        autoNumber: true,
        byteLength: 363,
        calculated: false,
        caseSensitive: false,
        createable: false,
        custom: false,
        defaultedOnCreate: false,
        deprecatedAndHidden: false,
        digits: 0,
        filterable: true,
        groupable: true,
        idLookup: false,
        label: 'Auto Number #',
        length: 121,
        name: 'AutoNumber',
        nameField: false,
        namePointing: false,
        nillable: false,
        permissionable: false,
        polymorphicForeignKey: false,
        precision: 0,
        queryByDistance: false,
        restrictedPicklist: false,
        scale: 0,
        searchPrefilterable: false,
        soapType: 'xsd:string',
        sortable: true,
        type: 'string',
        unique: false,
        updateable: false,
      }
      let salesforceAutoNumberField: SalesforceField
      beforeEach(() => {
        salesforceAutoNumberField = _.cloneDeep(origSalesforceAutonumberField)
      })

      describe('Non nameField', () => {
        it('Should fetch as AutoNumber field with hidden annotation true and required false', () => {
          const fieldElement = getSObjectFieldElement(
            dummyElem,
            salesforceAutoNumberField,
            serviceIds,
            {}
          )
          expect(fieldElement.type).toEqual(Types.primitiveDataTypes.AutoNumber)
          expect(fieldElement.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toBeTruthy()
          expect(fieldElement.annotations[CORE_ANNOTATIONS.REQUIRED]).toBeFalsy()
        })
      })

      describe('For nameField', () => {
        it('Should fetch as AutoNumber field with hidden annotation true and required false', () => {
          salesforceAutoNumberField.nameField = true
          const fieldElement = getSObjectFieldElement(
            dummyElem,
            salesforceAutoNumberField,
            serviceIds,
            {}
          )
          expect(fieldElement.type).toEqual(Types.primitiveDataTypes.AutoNumber)
          expect(fieldElement.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toBeTruthy()
          expect(fieldElement.annotations[CORE_ANNOTATIONS.REQUIRED]).toBeFalsy()
        })
      })
    })

    describe('name field transformation', () => {
      const origSalesforceNameField: SalesforceField = {
        aggregatable: true,
        cascadeDelete: false,
        dependentPicklist: false,
        externalId: false,
        htmlFormatted: false,
        autoNumber: false,
        byteLength: 363,
        calculated: false,
        caseSensitive: false,
        createable: false,
        custom: false,
        defaultedOnCreate: false,
        deprecatedAndHidden: false,
        digits: 0,
        extraTypeInfo: 'personname',
        filterable: true,
        groupable: true,
        idLookup: false,
        label: 'Full Name',
        length: 121,
        name: 'Name',
        nameField: true,
        namePointing: false,
        nillable: false,
        permissionable: false,
        polymorphicForeignKey: false,
        precision: 0,
        queryByDistance: false,
        restrictedPicklist: false,
        scale: 0,
        searchPrefilterable: false,
        soapType: 'xsd:string',
        sortable: true,
        type: 'string',
        unique: false,
        updateable: false,
      }

      let salesforceNameField: SalesforceField
      beforeEach(() => {
        salesforceNameField = _.cloneDeep(origSalesforceNameField)
      })

      it('should fetch name field with the object type when object has it as compound field', async () => {
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceNameField,
          serviceIds,
          { Name: 'Name' }
        )
        expect(fieldElement.type).toEqual(Types.compoundDataTypes.Name)
      })

      it('should fetch name field as text type when no name compound field in object', async () => {
        const fieldElement = getSObjectFieldElement(dummyElem, salesforceNameField, serviceIds, {})
        expect(fieldElement.type).toEqual(Types.primitiveDataTypes.Text)
      })
    })
  })

  describe('toCustomField', () => {
    const elemID = new ElemID('salesforce', 'test')
    const field = new Field(
      new ObjectType({ elemID }), 'name', Types.primitiveDataTypes.Text, { [LABEL]: 'Labelo' },
    )

    it('should have label for custom field', () => {
      field.annotations[API_NAME] = 'Test__c.Custom__c'
      const customField = toCustomField(field)
      expect(customField.label).toEqual('Labelo')
    })
    it('should convert geolocation type to location', () => {
      field.type = Types.compoundDataTypes.Location
      const customField = toCustomField(field)
      expect(customField.type).toEqual('Location')
    })

    it('should remove internalId', () => {
      field.annotations[INTERNAL_ID_ANNOTATION] = 'internal id'
      const customField = toCustomField(field)
      expect(customField).not.toHaveProperty(INTERNAL_ID_ANNOTATION)
    })
  })

  describe('toCustomProperties', () => {
    const elemID = new ElemID('salesforce', 'test')

    describe('annotations transformation', () => {
      const notInAnnotationTypes = 'notInAnnotationTypes'
      const objType = new ObjectType({
        elemID,
        annotationTypes: {
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
      beforeEach(() => {
        customObj = toCustomProperties(objType, false)
      })

      it('should transform annotations', () => {
        expect(_.get(customObj, DESCRIPTION)).toEqual('MyDescription')
      })

      it('should not transform skiplisted annotations', () => {
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
            type: Types.primitiveDataTypes.Text,
            annotations: { [API_NAME]: 'Test__c' },
          },
          [ignoredField]: {
            type: Types.primitiveDataTypes.Text,
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
        beforeEach(() => {
          customObj = toCustomProperties(
            objType, true, [objType.fields[ignoredField].annotations[API_NAME]],
          )
        })
        it('should have correct name', () => {
          expect(customObj.fullName).toEqual(objType.annotations[API_NAME])
        })
        it('should have fields', () => {
          expect(customObj.fields).toBeDefined()
          expect(makeArray(customObj.fields).map(f => f.fullName)).toContainEqual(
            objType.fields[existingField].annotations[API_NAME]
          )
        })
        it('should not have ignored fields', () => {
          expect(makeArray(customObj.fields).map(f => f.fullName)).not.toContainEqual(
            objType.fields[ignoredField].annotations[API_NAME]
          )
        })
      })

      describe('without fields', () => {
        let customObj: CustomObject
        beforeEach(() => {
          customObj = toCustomProperties(objType, false)
        })
        it('should not contain fields', () => {
          expect(customObj.fields).toBeUndefined()
        })
      })

      describe('create a custom settings object', () => {
        let customObj: CustomObject
        beforeEach(() => {
          const customSettingsObj = new ObjectType({
            elemID,
            annotationTypes: {
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
          customObj = toCustomProperties(customSettingsObj, false)
        })
        it('should not create fields that dont exist on custom settings objects', () => {
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
        fields: { [fieldName]: { type: Types.primitiveDataTypes.Lookup, annotations } },
      })
      let objectType: ObjectType
      beforeEach(() => {
        objectType = origObjectType.clone()
      })

      const assertCustomFieldTransformation = (customField: CustomField, expectedType: string,
        expectedRelationshipName: string, expectedDeleteConstraint: string | undefined,
        expectedReferenceTo: string[]):
        void => {
        expect(customField.type).toEqual(expectedType)
        expect(customField.relationshipName).toEqual(expectedRelationshipName)
        expect(customField.deleteConstraint).toEqual(expectedDeleteConstraint)
        expect(customField.referenceTo).toEqual(expectedReferenceTo)
      }

      it('should transform masterdetail field', async () => {
        const masterDetailField = objectType.fields[fieldName]
        masterDetailField.type = Types.primitiveDataTypes.MasterDetail
        masterDetailField.annotations[FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ] = true
        masterDetailField.annotations[FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL] = true
        const customMasterDetailField = toCustomField(masterDetailField)
        assertCustomFieldTransformation(customMasterDetailField,
          FIELD_TYPE_NAMES.MASTER_DETAIL, relationshipName, undefined, relatedTo)
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
          [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [{
            [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['ControllingVal1'],
            [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'Val1',
          },
          {
            [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['ControllingVal1', 'ControllingVal2'],
            [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'Val2',
          }],
        },
      }
      const fieldName = 'field_name'
      const origObjectType = new ObjectType({
        elemID,
        fields: { [fieldName]: { type: Types.primitiveDataTypes.Picklist, annotations } },
      })
      let obj: ObjectType
      beforeEach(() => {
        obj = origObjectType.clone()
      })

      it('should transform value set for picklist field', async () => {
        const picklistField = toCustomField(obj.fields[fieldName])
        expect(picklistField.type)
          .toEqual(FIELD_TYPE_NAMES.PICKLIST)
        expect(picklistField?.valueSet?.valueSetDefinition?.value).toEqual([
          new CustomPicklistValue('Val1', false, true),
          new CustomPicklistValue('Val2', false, true, 'Val2', '#FFFF00'),
        ])
      })

      it('should transform field dependency for picklist field', async () => {
        const customFieldWithFieldDependency = toCustomField(obj.fields[fieldName])
        expect(customFieldWithFieldDependency.type)
          .toEqual(FIELD_TYPE_NAMES.PICKLIST)
        expect(customFieldWithFieldDependency?.valueSet?.controllingField)
          .toEqual('ControllingFieldName')
        const valueSettings = customFieldWithFieldDependency?.valueSet?.valueSettings
        expect(valueSettings).toHaveLength(2)
        expect(valueSettings?.[0].valueName).toEqual('Val1')
        expect(valueSettings?.[0].controllingFieldValue).toEqual(['ControllingVal1'])
        expect(valueSettings?.[1].valueName).toEqual('Val2')
        expect(valueSettings?.[1].controllingFieldValue)
          .toEqual(['ControllingVal1', 'ControllingVal2'])
      })

      it('should transform field dependency for multi picklist field', async () => {
        obj.fields[fieldName].type = Types.primitiveDataTypes.MultiselectPicklist
        const customFieldWithFieldDependency = toCustomField(obj.fields[fieldName])
        expect(customFieldWithFieldDependency.type)
          .toEqual(FIELD_TYPE_NAMES.MULTIPICKLIST)
        expect(customFieldWithFieldDependency?.valueSet?.controllingField)
          .toEqual('ControllingFieldName')
        const valueSettings = customFieldWithFieldDependency?.valueSet?.valueSettings
        expect(valueSettings).toHaveLength(2)
        expect(valueSettings?.[0].valueName).toEqual('Val1')
        expect(valueSettings?.[0].controllingFieldValue).toEqual(['ControllingVal1'])
        expect(valueSettings?.[1].valueName).toEqual('Val2')
        expect(valueSettings?.[1].controllingFieldValue)
          .toEqual(['ControllingVal1', 'ControllingVal2'])
      })

      it('should ignore field dependency when not defined', async () => {
        delete obj.fields[fieldName].annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
        const customFieldWithFieldDependency = toCustomField(obj.fields[fieldName])
        expect(customFieldWithFieldDependency.type)
          .toEqual(FIELD_TYPE_NAMES.PICKLIST)
        expect(customFieldWithFieldDependency?.valueSet?.controllingField).toBeUndefined()
        expect(customFieldWithFieldDependency?.valueSet?.valueSettings).toBeUndefined()
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
        fields: { [fieldName]: { type: Types.primitiveDataTypes.Picklist, annotations } },
      })
      let obj: ObjectType
      beforeEach(() => {
        obj = origObjectType.clone()
      })

      it('should transform global picklist field', async () => {
        const customFieldWithGlobalPicklist = toCustomField(obj.fields[fieldName])
        expect(customFieldWithGlobalPicklist.type)
          .toEqual(FIELD_TYPE_NAMES.PICKLIST)
        expect(customFieldWithGlobalPicklist?.valueSet?.valueSetName).toEqual('gvs')
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
        [FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: [{
          [FILTER_ITEM_FIELDS.FIELD]: 'FieldName1',
          [FILTER_ITEM_FIELDS.OPERATION]: 'equals',
          [FILTER_ITEM_FIELDS.VALUE]: 'val1',
        },
        {
          [FILTER_ITEM_FIELDS.FIELD]: 'FieldName2',
          [FILTER_ITEM_FIELDS.OPERATION]: 'equals',
          [FILTER_ITEM_FIELDS.VALUE]: 'val2',
        }],
      }
      const fieldName = 'field_name'
      const origObjectType = new ObjectType({
        elemID,
        fields: { [fieldName]: { type: Types.primitiveDataTypes.Summary, annotations } },
      })
      let obj: ObjectType
      beforeEach(() => {
        obj = _.clone(origObjectType)
      })

      it('should transform rollup summary field', async () => {
        const rollupSummaryInfo = toCustomField(obj.fields[fieldName])
        expect(rollupSummaryInfo.type)
          .toEqual(FIELD_TYPE_NAMES.ROLLUP_SUMMARY)
        expect(_.get(rollupSummaryInfo, 'summarizedField'))
          .toEqual('Opportunity.Amount')
        expect(_.get(rollupSummaryInfo, 'summaryForeignKey'))
          .toEqual('Opportunity.AccountId')
        expect(_.get(rollupSummaryInfo, 'summaryOperation'))
          .toEqual('count')
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
        delete obj.fields[fieldName].annotations[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]
        const rollupSummaryInfo = toCustomField(obj.fields[fieldName])
        expect(rollupSummaryInfo.type)
          .toEqual(FIELD_TYPE_NAMES.ROLLUP_SUMMARY)
        expect(_.get(rollupSummaryInfo, 'summarizedField'))
          .toEqual('Opportunity.Amount')
        expect(_.get(rollupSummaryInfo, 'summaryForeignKey'))
          .toEqual('Opportunity.AccountId')
        expect(_.get(rollupSummaryInfo, 'summaryOperation'))
          .toEqual('count')
        expect(rollupSummaryInfo.summaryFilterItems).toBeUndefined()
      })
    })
  })

  describe('to records transformations', () => {
    const mockElemID = new ElemID(SALESFORCE, 'Test')
    const mockInstanceName = 'Instance'
    const values = {
      Id: '123',
      Name: {
        FirstName: 'A',
        LastName: 'B',
      },
      LocalAddress: {
        City: 'Manchester',
        State: 'UK',
      },
      LocalLocation: {
        Latitude: 345,
        Longitude: 222.2,
      },
      Creatable: 'Create',
      NotCreatable: 'DontSendMeOnCreate',
      Updateable: 'Update',
      NotUpdateable: 'NotUpdateable',

    }
    const instance = new InstanceElement(
      mockInstanceName,
      new ObjectType({
        elemID: mockElemID,
        fields: {
          Id: {
            type: BuiltinTypes.STRING,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          Name: {
            type: Types.compoundDataTypes.Name,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          LocalAddress: {
            type: Types.compoundDataTypes.Address,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          LocalLocation: {
            type: Types.compoundDataTypes.Location,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          NotCreatableNotUpdateableCompound: {
            type: Types.compoundDataTypes.Address,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: false,
              [FIELD_ANNOTATIONS.CREATABLE]: false,
            },
          },
          Creatable: {
            type: BuiltinTypes.STRING,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          NotCreatable: {
            type: BuiltinTypes.STRING,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: false,
            },
          },
          Updateable: {
            type: BuiltinTypes.STRING,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          NotUpdateable: {
            type: BuiltinTypes.STRING,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: false,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
        },
        annotationTypes: {},
        annotations: { [METADATA_TYPE]: CUSTOM_OBJECT },
      }),
      values,
    )

    describe('instancesToDeleteRecords', () => {
      it('should transform to Ids only records', () => {
        const recordResult = instancesToDeleteRecords([instance])
        expect(recordResult).toBeDefined()
        expect(recordResult.length).toEqual(1)
        expect(recordResult[0].Id).toBeDefined()
        expect(recordResult[0].Id).toEqual(values.Id)
        expect(recordResult[0].Name).toBeUndefined()
        expect(recordResult[0].LocalAddress).toBeUndefined()
        expect(recordResult[0].LocalLocation).toBeUndefined()
        expect(recordResult[0].Creatable).toBeUndefined()
        expect(recordResult[0].NotCreatable).toBeUndefined()
        expect(recordResult[0].Updateable).toBeUndefined()
        expect(recordResult[0].NotUpdateable).toBeUndefined()
        expect(recordResult[0].NotCreatableNotUpdateableCompound).toBeUndefined()
      })
    })

    describe('instancesToCreateRecords', () => {
      let recordResult: SalesforceRecord[]
      beforeEach(() => {
        recordResult = instancesToCreateRecords([instance])
        expect(recordResult).toBeDefined()
        expect(recordResult.length).toEqual(1)
      })

      it('should not change creatable non-compound values', () => {
        expect(recordResult[0].Id).toBeDefined()
        expect(recordResult[0].Id).toEqual(values.Id)
        expect(recordResult[0].Creatable).toBeDefined()
        expect(recordResult[0].Creatable).toEqual(values.Creatable)
        expect(recordResult[0].Updateable).toBeDefined()
        expect(recordResult[0].Updateable).toEqual(values.Updateable)
        expect(recordResult[0].NotUpdateable).toBeDefined()
        expect(recordResult[0].NotUpdateable).toEqual(values.NotUpdateable)
      })

      it('should remove non-creatable values', () => {
        expect(recordResult[0].NotCreatable).toBeUndefined()
        expect(recordResult[0].NotCreatableNotUpdateableCompound).toBeUndefined()
      })

      it('should transform compound fields', () => {
        expect(recordResult[0].FirstName).toBeDefined()
        expect(recordResult[0].FirstName).toEqual(values.Name.FirstName)
        expect(recordResult[0].LastName).toBeDefined()
        expect(recordResult[0].LastName).toEqual(values.Name.LastName)
        expect(recordResult[0].LocalCity).toBeDefined()
        expect(recordResult[0].LocalCity).toEqual(values.LocalAddress.City)
        expect(recordResult[0].LocalState).toBeDefined()
        expect(recordResult[0].LocalState).toEqual(values.LocalAddress.State)
        expect(recordResult[0].LocalLongitude).toBeDefined()
        expect(recordResult[0].LocalLongitude).toEqual(values.LocalLocation.Longitude)
        expect(recordResult[0].LocalLatitude).toBeDefined()
        expect(recordResult[0].LocalLatitude).toEqual(values.LocalLocation.Latitude)
      })
    })

    describe('instancesToUpdateRecords', () => {
      let recordResult: SalesforceRecord[]
      beforeEach(() => {
        recordResult = instancesToUpdateRecords([instance])
        expect(recordResult).toBeDefined()
        expect(recordResult.length).toEqual(1)
      })

      it('should not change creatable non-compound values', () => {
        expect(recordResult[0].Id).toBeDefined()
        expect(recordResult[0].Id).toEqual(values.Id)
        expect(recordResult[0].Creatable).toBeDefined()
        expect(recordResult[0].Creatable).toEqual(values.Creatable)
        expect(recordResult[0].Updateable).toBeDefined()
        expect(recordResult[0].Updateable).toEqual(values.Updateable)
        expect(recordResult[0].NotCreatable).toBeDefined()
        expect(recordResult[0].NotCreatable).toEqual(values.NotCreatable)
      })

      it('should remove non-updateable values', () => {
        expect(recordResult[0].NotUpdateable).toBeUndefined()
        expect(recordResult[0].NotCreatableNotUpdateableCompound).toBeUndefined()
      })

      it('should transform compound fields', () => {
        expect(recordResult[0].FirstName).toBeDefined()
        expect(recordResult[0].FirstName).toEqual(values.Name.FirstName)
        expect(recordResult[0].LastName).toBeDefined()
        expect(recordResult[0].LastName).toEqual(values.Name.LastName)
        expect(recordResult[0].LocalCity).toBeDefined()
        expect(recordResult[0].LocalCity).toEqual(values.LocalAddress.City)
        expect(recordResult[0].LocalState).toBeDefined()
        expect(recordResult[0].LocalState).toEqual(values.LocalAddress.State)
        expect(recordResult[0].LocalLongitude).toBeDefined()
        expect(recordResult[0].LocalLongitude).toEqual(values.LocalLocation.Longitude)
        expect(recordResult[0].LocalLatitude).toBeDefined()
        expect(recordResult[0].LocalLatitude).toEqual(values.LocalLocation.Latitude)
      })
    })
  })

  describe('type definitions', () => {
    it('should include apiName annotation with service_id type', async () => {
      Object.values(Types.getAllFieldTypes()).forEach(type => {
        expect(type.annotationTypes[API_NAME]).toEqual(BuiltinTypes.SERVICE_ID)
      })
    })
  })

  describe('create a path with subtype for subtypes', () => {
    let client: SalesforceClient
    let connection: MockInterface<Connection>

    beforeEach(() => {
      const mock = mockClient()
      client = mock.client
      connection = mock.connection
    })

    const nestedField = mockValueTypeField({
      name: 'Nested',
      soapType: 'NestedFieldType',
    })
    const field = mockValueTypeField({
      fields: [nestedField],
      name: 'Field',
      soapType: 'FieldType',
    })
    it('should not create a base element as subtype', async () => {
      const [element] = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [],
        baseTypeNames: new Set(['BaseType']),
        childTypeNames: new Set(),
        client,
      })
      expect(element.path).not.toContain(SUBTYPES_PATH)
    })

    it('should create a type which is not a base element as subtype', async () => {
      const [element] = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [],
        baseTypeNames: new Set(),
        childTypeNames: new Set(),
        client,
      })
      expect(element.path).toContain(SUBTYPES_PATH)
    })

    it('should add internal id field for base types', async () => {
      const elements = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [field],
        baseTypeNames: new Set(['BaseType', 'FieldType', 'NestedFieldType']),
        childTypeNames: new Set('SomeType'),
        client,
      })
      expect(elements).toHaveLength(1)
      const [element] = elements
      expect(element.fields[INTERNAL_ID_FIELD]).toBeDefined()
    })

    it('should add internal id field for child types', async () => {
      const elements = await createMetadataTypeElements({
        name: 'SomeType',
        fields: [field],
        baseTypeNames: new Set(['BaseType', 'FieldType', 'NestedFieldType']),
        childTypeNames: new Set(['SomeType']),
        client,
      })
      expect(elements).toHaveLength(1)
      const [element] = elements
      expect(element.fields[INTERNAL_ID_FIELD]).toBeDefined()
    })

    it('should not add id field if not base or child type', async () => {
      const elements = await createMetadataTypeElements({
        name: 'OtherType',
        fields: [field],
        baseTypeNames: new Set(['BaseType', 'FieldType', 'NestedFieldType']),
        childTypeNames: new Set('SomeType'),
        client,
      })
      expect(elements).toHaveLength(1)
      const [element] = elements
      expect(element.fields[INTERNAL_ID_FIELD]).toBeUndefined()
    })

    it('should not create a field which is a base element as subtype', async () => {
      const elements = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [field],
        baseTypeNames: new Set(['BaseType', 'FieldType', 'NestedFieldType']),
        childTypeNames: new Set(),
        client,
      })
      expect(elements).toHaveLength(1)
      const [element] = elements
      expect(element.path).not.toContain(SUBTYPES_PATH)
      expect(connection.metadata.describeValueType).toHaveBeenCalledTimes(0)
    })

    it('should create a field and nested field which are not a base element as subtype', async () => {
      connection.metadata.describeValueType.mockResolvedValue(mockDescribeValueResult({
        valueTypeFields: [{ name: 'inner', soapType: 'string' }],
      }))
      const elements = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [field],
        baseTypeNames: new Set(['BaseType']),
        childTypeNames: new Set(),
        client,
      })
      expect(elements).toHaveLength(3)
      const [element, fieldType, nestedFieldType] = elements
      expect(element.path).not.toContain(SUBTYPES_PATH)
      expect(fieldType.path).toContain(SUBTYPES_PATH)
      expect(connection.metadata.describeValueType).toHaveBeenCalledTimes(1)
      expect(nestedFieldType.path).toContain(SUBTYPES_PATH)
      expect(nestedFieldType.fields.inner.type).toEqual(BuiltinTypes.STRING)
    })

    it('should create nested field as subtype when nested field has fields', async () => {
      connection.metadata.describeValueType.mockResolvedValue(mockDescribeValueResult({
        valueTypeFields: [{ name: 'inner', soapType: 'string' }],
      }))
      const elements = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [field],
        baseTypeNames: new Set(['BaseType']),
        childTypeNames: new Set(),
        client,
      })
      expect(elements).toHaveLength(3)
      const [element, fieldType, nestedFieldType] = elements
      expect(element.path).not.toContain(SUBTYPES_PATH)
      expect(fieldType.path).toContain(SUBTYPES_PATH)
      expect(nestedFieldType.path).toContain(SUBTYPES_PATH)
      expect(connection.metadata.describeValueType).toHaveBeenCalledTimes(1)
    })

    it('should not create nested field when nested field has no fields', async () => {
      const elements = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [field],
        baseTypeNames: new Set(['BaseType']),
        childTypeNames: new Set(),
        client,
      })
      expect(elements).toHaveLength(2)
      const [element, fieldType] = elements
      expect(element.path).not.toContain(SUBTYPES_PATH)
      expect(fieldType.path).toContain(SUBTYPES_PATH)
      expect(connection.metadata.describeValueType).toHaveBeenCalledTimes(1)
    })

    it('should not create nested field when nested field has no fields and is a picklist', async () => {
      const elements = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [mockValueTypeField({
          name: 'picklistField',
          picklistValues: [
            { active: true, value: 'yes', defaultValue: true },
            { active: true, value: 'no', defaultValue: false },
          ],
          soapType: 'MyPicklist',
        })],
        baseTypeNames: new Set(['BaseType']),
        childTypeNames: new Set(),
        client,
      })
      expect(elements).toHaveLength(1)
      expect(elements[0].path).not.toContain(SUBTYPES_PATH)
      expect(connection.metadata.describeValueType).toHaveBeenCalledTimes(0)
    })

    it('should not create nested field when nested field has no fields and its name is not capitalized', async () => {
      const elements = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [mockValueTypeField({
          name: 'noUpperCaseTypeName',
          soapType: 'base64Binary',
        })],
        baseTypeNames: new Set(['BaseType']),
        childTypeNames: new Set(),
        client,
      })
      expect(elements).toHaveLength(1)
      expect(elements[0].path).not.toContain(SUBTYPES_PATH)
      expect(connection.metadata.describeValueType).toHaveBeenCalledTimes(0)
    })

    it('should add a reference if the field is a foreign key', async () => {
      const referenceField = mockValueTypeField({
        name: 'FKRef',
        soapType: 'FKRefFieldType',
        isForeignKey: true,
        foreignKeyDomain: 'ReferencedTypeName',
      })
      const fieldWithNestedReference = mockValueTypeField({
        fields: [referenceField],
        name: 'FieldWithNestedReference',
        soapType: 'FieldWithNestedReferenceType',
      })
      const elements = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [fieldWithNestedReference],
        baseTypeNames: new Set(['BaseType']),
        childTypeNames: new Set(),
        client,
      })
      expect(elements).toHaveLength(2)
      const fieldWithNestedRef = elements[1]
      expect(fieldWithNestedRef.fields[referenceField.name].annotations?.foreignKeyDomain).toEqual(['ReferencedTypeName'])
    })

    it('should add a reference if the field is a foreign key with a few options', async () => {
      // assinging foreignKeyDomain separately because the salesforce type incorrectly specifies
      // it as string when it can also be string[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const referenceField: any = mockValueTypeField({
        name: 'FKRef',
        soapType: 'FKRefFieldType',
        isForeignKey: true,
      })
      referenceField.foreignKeyDomain = ['ReferencedTypeName', 'OtherReferencedTypeName']
      const elements = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [referenceField],
        baseTypeNames: new Set(['BaseType']),
        childTypeNames: new Set(),
        client,
      })
      expect(elements).toHaveLength(1)
      const baseField = elements[0]
      expect(baseField.fields[referenceField.name].annotations?.foreignKeyDomain).toEqual(
        ['ReferencedTypeName', 'OtherReferencedTypeName']
      )
    })
  })

  describe('missing fields', () => {
    let connection: MockInterface<Connection>
    let baseType: MetadataObjectType
    let complexType: MetadataObjectType
    let emptyComplexType: MetadataObjectType
    beforeEach(async () => {
      const clientAndConn = mockClient()
      connection = clientAndConn.connection
      connection.metadata.describeValueType.mockImplementation(async typeName => (
        typeName.endsWith('ComplexType')
          ? mockDescribeValueResult({ valueTypeFields: [mockValueTypeField({ name: 'compField', soapType: 'string' })] })
          : mockDescribeValueResult({ valueTypeFields: [] })
      ))
      const missingFields = convertRawMissingFields([
        {
          id: 'BaseType',
          fields: [
            { name: 'str', type: 'string' },
            { name: 'num', type: 'integer' },
            { boolean: ['bool1', 'bool2'] },
            { name: 'enum', type: 'MyEnumType', picklistValues: ['v1', 'v2'] },
            { name: 'complex', type: 'ComplexType' },
            { name: 'emptyComplex', type: 'ComplexTypeEmpty' },
          ],
        },
        {
          id: 'ComplexType',
          fields: [{ name: 'str', type: 'string' }],
        },
        {
          id: 'ComplexTypeEmpty',
          fields: [{ name: 'str', type: 'string' }],
        },
      ])
      const elements = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [mockValueTypeField({ name: 'normal', soapType: 'string' })],
        baseTypeNames: new Set(['BaseType']),
        childTypeNames: new Set(),
        client: clientAndConn.client,
        missingFields,
      })
      const elementsByTypeName = _.keyBy(elements, elem => elem.elemID.typeName)
      baseType = elementsByTypeName.BaseType
      complexType = elementsByTypeName.ComplexType
      emptyComplexType = elementsByTypeName.ComplexTypeEmpty

      expect(baseType).toBeDefined()
      expect(complexType).toBeDefined()
      expect(emptyComplexType).toBeDefined()
    })
    it('should keep existing fields', () => {
      expect(baseType.fields).toHaveProperty(
        'normal', expect.objectContaining({ type: BuiltinTypes.STRING })
      )
      expect(complexType.fields).toHaveProperty(
        'compField', expect.objectContaining({ type: BuiltinTypes.STRING })
      )
    })
    it('should add missing fields with builtin types', () => {
      expect(baseType.fields).toHaveProperty(
        'str', expect.objectContaining({ type: BuiltinTypes.STRING })
      )
      expect(baseType.fields).toHaveProperty(
        'num', expect.objectContaining({ type: BuiltinTypes.NUMBER })
      )
    })
    it('should add missing boolean fields', () => {
      expect(baseType.fields).toHaveProperty(
        'bool1', expect.objectContaining({ type: BuiltinTypes.BOOLEAN })
      )
      expect(baseType.fields).toHaveProperty(
        'bool2', expect.objectContaining({ type: BuiltinTypes.BOOLEAN })
      )
    })
    it('should add missing enum fields', () => {
      expect(baseType.fields).toHaveProperty(
        'enum',
        expect.objectContaining({
          type: BuiltinTypes.STRING,
          annotations: expect.objectContaining({
            [CORE_ANNOTATIONS.RESTRICTION]: expect.objectContaining(
              createRestriction({ values: ['v1', 'v2'] }),
            ),
          }),
        })
      )
    })
    it('should add complex fields with recursive describe calls', () => {
      expect(connection.metadata.describeValueType).toHaveBeenCalledWith(
        expect.stringMatching(/.*ComplexType$/)
      )
      expect(complexType.fields).toHaveProperty(
        'str', expect.objectContaining({ type: BuiltinTypes.STRING })
      )
    })
    it('should add complex fields even when describe on them is empty', () => {
      expect(connection.metadata.describeValueType).toHaveBeenCalledWith(
        expect.stringMatching(/.*ComplexTypeEmpty$/)
      )
      expect(emptyComplexType.fields).toHaveProperty(
        'str', expect.objectContaining({ type: BuiltinTypes.STRING })
      )
    })
  })

  describe('transform references to SF lookup value', () => {
    const instanceFullName = 'Instance'
    const objectApiName = 'Object'
    const regValue = 'REG'
    const newValue = 'NEW'

    const elementID = new ElemID('salesforce', 'elememt')

    const typeRef = new ReferenceExpression(elementID.createNestedID(
      'annotation', API_NAME
    ), objectApiName)

    const element = new ObjectType({
      elemID: elementID,
      annotationTypes: {
        instanceRef: BuiltinTypes.STRING,
        objectRef: BuiltinTypes.STRING,
        valueRef: BuiltinTypes.STRING,
        reg: BuiltinTypes.STRING,
      },
      annotations: {
        [API_NAME]: objectApiName,
        typeRef,
      },
    })

    const instance = new InstanceElement('instance', element, {
      [INSTANCE_FULL_NAME_FIELD]: instanceFullName,
    })
    const valueRef = new ReferenceExpression(instance.elemID.createNestedID('ref'), regValue, instance)
    const instanceRef = new ReferenceExpression(instance.elemID, instance, instance)
    const elementRef = new ReferenceExpression(element.elemID, element, element)
    const elemID = new ElemID('salesforce', 'base')
    const orig = new ObjectType({
      elemID,
      annotationTypes: {
        instanceRef: BuiltinTypes.STRING,
        objectRef: BuiltinTypes.STRING,
        valueRef: BuiltinTypes.STRING,
        reg: BuiltinTypes.STRING,
      },
      annotations: {
        instanceRef,
        objectRef: elementRef,
        valueRef,
        reg: regValue,
        changeToRef: regValue,
      },
      fields: {
        field: {
          type: element,
          annotations: {
            instanceRef,
            objectRef: elementRef,
            valueRef,
            reg: regValue,
            changeToRef: regValue,
          },
        },
      },
    })
    const origCopy = orig.clone()
    const modified = resolveValues(orig, getLookUpName)

    it('should not modify the original element', () => {
      expect(orig).toEqual(origCopy)
    })

    it('should transform element ref values', () => {
      expect(modified.annotations.instanceRef).toEqual(instanceFullName)
      expect(modified.annotations.objectRef).toEqual(objectApiName)
      expect(modified.annotations.valueRef).toEqual(regValue)
      expect(modified.annotations.changeToRef).toEqual(regValue)

      expect(modified.fields.field.annotations.instanceRef).toEqual(instanceFullName)
      expect(modified.fields.field.annotations.objectRef).toEqual(objectApiName)
      expect(modified.fields.field.annotations.valueRef).toEqual(regValue)
      expect(modified.fields.field.annotations.changeToRef).toEqual(regValue)
    })

    it('should transform regular ref values', () => {
      expect(modified.annotations.reg).toEqual(regValue)
      expect(modified.annotations.changeToRef).toEqual(regValue)
      expect(modified.fields.field.annotations.reg).toEqual(regValue)
      expect(modified.fields.field.annotations.changeToRef).toEqual(regValue)

      // Should not resolve field type annotations
      expect(modified.fields.field.type.annotations.typeRef).toEqual(typeRef)
    })

    it('should transform back to orig value', () => {
      expect(restoreValues(orig, modified, getLookUpName)).toEqual(orig)
    })

    it('should maintain new values when transforming back to orig value', () => {
      const after = modified.clone()
      after.annotations.new = newValue
      after.fields.field.annotations.new = newValue
      after.annotations.regValue = newValue
      after.fields.field.annotations.regValue = newValue
      after.fields.field.annotations.changeToRef = instanceRef
      after.annotations.changeToRef = instanceRef
      const restored = restoreValues(orig, after, getLookUpName)
      expect(restored.annotations.new).toEqual(newValue)
      expect(restored.fields.field.annotations.new).toEqual(newValue)
      expect(restored.annotations.regValue).toEqual(newValue)
      expect(restored.fields.field.annotations.regValue).toEqual(newValue)
      expect(restored.fields.field.annotations.changeToRef).toEqual(instanceRef)
      expect(restored.annotations.changeToRef).toEqual(instanceRef)
    })
  })
  describe('getLookUpName', () => {
    const refObject = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'Lead'),
      fields: { test: {
        type: BuiltinTypes.STRING,
        annotations: {
          [API_NAME]: 'Lead.Test__c',
        },
      } },
    })
    describe('with references to map values', () => {
      const mockResolvedValue = { name: 'Default', fridayEndTime: '00:00:00.000Z' }
      const mockBusinessHoursSettingsType = new ObjectType({
        elemID: new ElemID(SALESFORCE, BUSINESS_HOURS_METADATA_TYPE),
        annotations: {
          [METADATA_TYPE]: BUSINESS_HOURS_METADATA_TYPE,
        },
      })
      const mockEntitlementProcessType = new ObjectType({ elemID: new ElemID(SALESFORCE, 'EntitlementProcess'),
        fields: { businessHours: { type: allMissingSubTypes[0] } },
        annotations: {
          [METADATA_TYPE]: 'EntitlementProcess',
        } })
      const mockBusinessHoursInstance = new InstanceElement('BusinessHours', mockBusinessHoursSettingsType)
      const testField = new Field(mockEntitlementProcessType, 'businessHours', BuiltinTypes.STRING)
      const mockDefaultElemId = new ElemID(SALESFORCE, BUSINESS_HOURS_METADATA_TYPE, 'instance', 'Default')
      it('should resolve with mapKey strategy', () => {
        expect(getLookUpName({
          ref: new ReferenceExpression(
            mockDefaultElemId,
            mockResolvedValue,
            mockBusinessHoursInstance
          ),
          field: testField,
          path: new ElemID(SALESFORCE, 'EntitlementProcess'),
        })).toEqual('Default')
      })
    })

    describe('with fields in layout instance', () => {
      const mockLayoutItem = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'LayoutItem'),
        fields: { field: { type: BuiltinTypes.STRING } },
        annotations: { [METADATA_TYPE]: 'LayoutItem' },
      })
      const mockLayoutColumn = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'LayoutColumn'),
        fields: { layoutItems: { type: new ListType(mockLayoutItem) } },
        annotations: { [METADATA_TYPE]: 'LayoutColumn' },
      })
      const mockLayoutSection = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'LayoutSection'),
        fields: { layoutColumns: { type: new ListType(mockLayoutColumn) } },
        annotations: { [METADATA_TYPE]: 'LayoutSection' },
      })
      const mockLayoutType = new ObjectType({
        elemID: LAYOUT_TYPE_ID,
        fields: { layoutSections: { type: new ListType(mockLayoutSection) } },
        annotations: { [METADATA_TYPE]: LAYOUT_TYPE_ID_METADATA_TYPE },
      })
      const mockLayoutInstance = new InstanceElement('test', mockLayoutType, {})
      it('should resolve to relative api name', () => {
        const testField = refObject.fields.test
        expect(getLookUpName({
          ref: new ReferenceExpression(testField.elemID, testField, refObject),
          field: mockLayoutItem.fields.field,
          path: mockLayoutInstance.elemID.createNestedID(
            'layoutSections', '0', 'layoutColumns', '0', 'layoutItems', '0', 'field'
          ),
        })).toEqual('Test__c')
      })
    })
    describe('with fields in workflow field update instance', () => {
      const workflowFieldUpdate = new ObjectType({
        elemID: new ElemID(
          SALESFORCE,
          WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
        ),
        fields: { field: { type: BuiltinTypes.STRING } },
        annotations: { [METADATA_TYPE]: WORKFLOW_FIELD_UPDATE_METADATA_TYPE },
      })
      const mockWorkflowFieldUpdateInstance = new InstanceElement(
        'User_test1',
        workflowFieldUpdate,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'User.test1',
          field: 'test',
        },
      )
      it('should resolve to relative api name', () => {
        const testField = refObject.fields.test
        expect(getLookUpName({
          ref: new ReferenceExpression(testField.elemID, testField, refObject),
          field: workflowFieldUpdate.fields.field,
          path: mockWorkflowFieldUpdateInstance.elemID.createNestedID('field'),
        })).toEqual('Test__c')
      })
    })
    describe('with fields in product_rule (custom object) lookup_product_field update instance', () => {
      const mockProductRuleType = new ObjectType(
        {
          elemID: new ElemID(SALESFORCE, CPQ_PRODUCT_RULE),
          fields: {
            [CPQ_LOOKUP_PRODUCT_FIELD]: { type: BuiltinTypes.STRING },
          },
          annotations: {
            [METADATA_TYPE]: CUSTOM_OBJECT,
            [API_NAME]: CPQ_PRODUCT_RULE,
          },
        },
      )
      const testField = refObject.fields.test
      const mockProductRuleInst = new InstanceElement(
        'mockProductRule',
        mockProductRuleType,
        {
          [CPQ_LOOKUP_PRODUCT_FIELD]: new ReferenceExpression(
            testField.elemID,
            testField,
            refObject
          ),
        },
      )
      it('should resolve to relative api name', () => {
        expect(getLookUpName({
          ref: mockProductRuleInst.value[CPQ_LOOKUP_PRODUCT_FIELD],
          field: mockProductRuleType.fields[CPQ_LOOKUP_PRODUCT_FIELD],
          path: mockProductRuleInst.elemID.createNestedID(CPQ_LOOKUP_PRODUCT_FIELD),
        })).toEqual('Test__c')
      })
    })
    describe('with fields in workflow rule instance', () => {
      const workflowActionReference = new ObjectType({
        elemID: new ElemID(SALESFORCE, WORKFLOW_ACTION_REFERENCE_METADATA_TYPE),
        fields: {
          name: { type: BuiltinTypes.STRING },
          type: { type: BuiltinTypes.STRING },
        },
        annotations: { [METADATA_TYPE]: WORKFLOW_ACTION_REFERENCE_METADATA_TYPE },
      })
      const workflowRule = new ObjectType({
        elemID: new ElemID(SALESFORCE, WORKFLOW_RULE_METADATA_TYPE),
        fields: { actions: { type: workflowActionReference } },
        annotations: { [METADATA_TYPE]: WORKFLOW_RULE_METADATA_TYPE },
      })
      const mockWorkflowRuleInstance = new InstanceElement(
        'User_rule1',
        workflowRule,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'User.rule1',
          actions: [{
            name: 'alert1',
            type: 'Alert',
          }],
        },
      )
      const workflowAlert = new ObjectType({
        elemID: new ElemID(SALESFORCE, WORKFLOW_ACTION_ALERT_METADATA_TYPE),
        annotations: { [METADATA_TYPE]: WORKFLOW_ACTION_ALERT_METADATA_TYPE },
      })
      const mockAlertInstance = new InstanceElement(
        'Opportunity_alert1',
        workflowAlert,
        { [INSTANCE_FULL_NAME_FIELD]: 'Opportunity.alert1' },
      )
      it('should resolve to relative api name', () => {
        expect(getLookUpName({
          ref: new ReferenceExpression(mockAlertInstance.elemID, mockAlertInstance),
          field: workflowActionReference.fields.name,
          path: mockWorkflowRuleInstance.elemID.createNestedID('actions', '0', 'name'),
        })).toEqual('alert1')
      })
    })
    describe('when field is not specified', () => {
      const srcObject = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'test'),
        fields: { test: { type: BuiltinTypes.STRING } },
        annotations: { [METADATA_TYPE]: 'test' },
      })
      const srcInst = new InstanceElement('test', srcObject, {})
      it('should resolve to full api name', () => {
        const testField = refObject.fields.test
        expect(getLookUpName({
          ref: new ReferenceExpression(testField.elemID, testField, refObject),
          path: srcInst.elemID.createNestedID('test'),
        })).toEqual('Lead.Test__c')
      })
    })
    describe('with all other cases', () => {
      const srcObject = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'test'),
        fields: { test: { type: BuiltinTypes.STRING } },
        annotations: { [METADATA_TYPE]: 'test' },
      })
      const srcInst = new InstanceElement('test', srcObject, {})
      it('should resolve to full api name', () => {
        const testField = refObject.fields.test
        expect(getLookUpName({
          ref: new ReferenceExpression(testField.elemID, testField, refObject),
          field: srcObject.fields.test,
          path: srcInst.elemID.createNestedID('test'),
        })).toEqual('Lead.Test__c')
      })
    })
  })
  describe('Renaming metadatatype tests', () => {
    it('Verify renaming function', () => {
      METADATA_TYPES_TO_RENAME.forEach((_value, key) => {
        const elemId: ElemID = Types.getElemId(key, false, undefined)
        expect(elemId.name).toEqual(METADATA_TYPES_TO_RENAME.get(key))
      })
    })
  })
  describe('metadata type guards', () => {
    const mdType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'test'),
      annotations: { [METADATA_TYPE]: 'test' },
    })
    const nonMdType = new ObjectType({ elemID: new ElemID(SALESFORCE, 'test2') })
    describe('isMetadataObjectType', () => {
      it('should return true for metadata object types', () => {
        expect(isMetadataObjectType(mdType)).toBeTruthy()
      })
      it('should return false for other object types', () => {
        expect(isMetadataObjectType(nonMdType)).toBeFalsy()
      })
    })
    describe('isMetadataInstanceElement', () => {
      it('should return true for metadata instances', () => {
        expect(isMetadataInstanceElement(new InstanceElement(
          'test',
          mdType,
          { [INSTANCE_FULL_NAME_FIELD]: 'test' },
        ))).toBeTruthy()
      })
      it('should return false for instance of non metadata types', () => {
        expect(isMetadataInstanceElement(new InstanceElement(
          'test',
          nonMdType,
          { [INSTANCE_FULL_NAME_FIELD]: 'test' },
        ))).toBeFalsy()
      })
      it('should return false for instances without a fullName', () => {
        expect(isMetadataInstanceElement(new InstanceElement(
          'test',
          mdType,
          {},
        ))).toBeFalsy()
      })
    })
  })

  describe('toDeployableInstance', () => {
    const mockElemID = new ElemID(SALESFORCE, 'Test')
    const mockInstanceName = 'Instance'
    const values = {
      Id: '123',
      Name: {
        FirstName: 'A',
        LastName: 'B',
      },
      LocalAddress: {
        City: 'Manchester',
        State: 'UK',
      },
      Creatable: 'Create',
      NotCreatable: 'DontSendMeOnCreate',
      Updateable: 'Update',
      NotUpdateable: 'NotUpdateable',

    }
    let instance: InstanceElement
    let res: InstanceElement

    beforeEach(() => {
      instance = new InstanceElement(
        mockInstanceName,
        new ObjectType({
          elemID: mockElemID,
          fields: {
            Id: {
              type: BuiltinTypes.STRING,
              annotations: {
                [FIELD_ANNOTATIONS.LOCAL_ONLY]: true,
              },
            },
            Name: {
              type: Types.compoundDataTypes.Name,
            },
            LocalAddress: {
              type: Types.compoundDataTypes.Address,
              annotations: {
                [FIELD_ANNOTATIONS.LOCAL_ONLY]: true,
                [FIELD_ANNOTATIONS.UPDATEABLE]: true,
                [FIELD_ANNOTATIONS.CREATABLE]: true,
              },
            },
          },
          annotationTypes: {},
          annotations: { [METADATA_TYPE]: CUSTOM_OBJECT },
        }),
        values,
      )
      res = toDeployableInstance(instance)
    })

    it('should hide local-only field', () => {
      expect(instance.value.Id).toBeDefined()
      expect(instance.value.Name).toBeDefined()
      expect(instance.value.LocalAddress).toBeDefined()
      expect(res.value.Id).toBeUndefined()
      expect(res.value.Name).toBeDefined()
      expect(res.value.LocalAddress).toBeUndefined()
    })
  })

  describe('transformPrimitive', () => {
    let mockObjType: ObjectType
    beforeAll(() => {
      mockObjType = new ObjectType({
        elemID: new ElemID('test', 'obj'),
        fields: {
          str: { type: BuiltinTypes.STRING },
          num: { type: BuiltinTypes.NUMBER },
          bool: { type: BuiltinTypes.BOOLEAN },
          obj: { type: new ObjectType({ elemID: new ElemID('test', 'nested') }) },
          unknown: { type: BuiltinTypes.UNKNOWN },
        },
      })
    })
    describe('with primitive field', () => {
      it('should convert number type', () => {
        expect(
          transformPrimitive({ value: '1', field: mockObjType.fields.num })
        ).toEqual(1)
      })
      it('should convert string type', () => {
        expect(
          transformPrimitive({ value: '1', field: mockObjType.fields.str })
        ).toEqual('1')
      })
      it('should convert boolean type', () => {
        expect(
          transformPrimitive({ value: 'true', field: mockObjType.fields.bool })
        ).toEqual(true)
      })
      it('should leave unknown type as-is', () => {
        expect(
          transformPrimitive({ value: '1', field: mockObjType.fields.unknown })
        ).toEqual('1')
        expect(
          transformPrimitive({ value: 1, field: mockObjType.fields.unknown })
        ).toEqual(1)
      })
      it('should convert values with xsi:type attribute', () => {
        expect(
          transformPrimitive({
            value: { _: 'true', $: { 'xsi:type': 'xsd:boolean' } },
            field: mockObjType.fields.bool,
          })
        ).toEqual(true)
        expect(
          transformPrimitive({
            value: { _: '12.3', $: { 'xsi:type': 'xsd:double' } },
            field: mockObjType.fields.num,
          })
        ).toEqual(12.3)
      })
      it('should convert value by field type if xsi:type is unrecognized', () => {
        expect(
          transformPrimitive({
            value: { _: 'true', $: { 'xsi:type': 'xsd:unknown' } },
            field: mockObjType.fields.bool,
          })
        ).toEqual(true)
        expect(
          transformPrimitive({
            value: { _: 'true', $: { 'xsi:type': 'xsd:unknown' } },
            field: mockObjType.fields.str,
          })
        ).toEqual('true')
      })
      it('should omit null values', () => {
        expect(transformPrimitive({
          value: { $: { 'xsi:nil': 'true' } }, field: mockObjType.fields.bool,
        })).toBeUndefined()
      })
      it('should not transform object types', () => {
        expect(transformPrimitive({
          value: { bla: 'foo' }, field: mockObjType.fields.obj,
        })).toEqual({ bla: 'foo' })
      })
      it('should not transform object values', () => {
        expect(transformPrimitive({
          value: { bla: 'foo' }, field: mockObjType.fields.string,
        })).toEqual({ bla: 'foo' })
      })
    })
  })
})
