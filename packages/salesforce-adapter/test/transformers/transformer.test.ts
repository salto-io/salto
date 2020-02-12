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
import _ from 'lodash'
import {
  ObjectType, ElemID, Field, BuiltinTypes, TypeElement, Field as TypeField, Values,
  CORE_ANNOTATIONS, ReferenceExpression, InstanceElement, bpCase,
} from 'adapter-api'
import { collections } from '@salto/lowerdash'
import { Field as SalesforceField, ValueTypeField } from 'jsforce'
import {
  getSObjectFieldElement, Types, toCustomField, toCustomObject,
  getValueTypeFieldElement, getCompoundChildFields, createMetadataTypeElements,
  transformReferences, restoreReferences,
} from '../../src/transformers/transformer'
import {
  FIELD_ANNOTATIONS,
  FIELD_TYPE_NAMES,
  LABEL,
  ADDRESS_FIELDS,
  SALESFORCE,
  GEOLOCATION_FIELDS,
  NAME_FIELDS,
  API_NAME,
  COMPOUND_FIELD_TYPE_NAMES,
  FIELD_LEVEL_SECURITY_ANNOTATION,
  FIELD_LEVEL_SECURITY_FIELDS,
  FIELD_DEPENDENCY_FIELDS,
  VALUE_SETTINGS_FIELDS,
  FILTER_ITEM_FIELDS,
  METADATA_TYPE,
  CUSTOM_OBJECT,
  VALUE_SET_FIELDS,
  SUBTYPES_PATH,
  INSTANCE_FULL_NAME_FIELD, DESCRIPTION,
} from '../../src/constants'
import { CustomField, FilterItem, CustomObject, CustomPicklistValue } from '../../src/client/types'
import SalesforceClient from '../../src/client/client'
import mockClient from '../client'
import { createValueSetEntry } from '../utils'

const { makeArray } = collections.array

describe('transformer', () => {
  describe('bpCase', () => {
    describe('names without special characters', () => {
      const normalNames = [
        'Offer__c', 'Lead', 'DSCORGPKG__DiscoverOrg_Update_History__c', 'NameWithNumber2',
        'CRMFusionDBR101__Scenario__C',
      ]
      it('should remain the same', () => {
        normalNames.forEach(name => expect(bpCase(name)).toEqual(name))
      })
    })

    describe('names with spaces', () => {
      it('should be replaced with _', () => {
        expect(bpCase('Analytics Cloud Integration User')).toEqual('Analytics_Cloud_Integration_User')
      })
    })
  })

  describe('getValueTypeFieldElement', () => {
    const salesforceValueTypeFieldBase: ValueTypeField = {
      fields: [],
      foreignKeyDomain: '',
      isForeignKey: false,
      isNameField: false,
      minOccurs: 0,
      name: 'Field',
      picklistValues: [],
      soapType: 'String',
      valueRequired: false,
    }
    const salesforceEnumField: ValueTypeField = _.merge({}, salesforceValueTypeFieldBase, {
      picklistValues: [
        { active: true, defaultValue: false, value: 'b' },
        { active: true, defaultValue: false, value: 'a' },
        { active: true, defaultValue: false, value: 'a' },
      ],
    })
    describe('enum field', () => {
      let enumField: TypeField
      beforeEach(() => {
        enumField = getValueTypeFieldElement(new ElemID('adapter', 'dummy'), salesforceEnumField,
          new Map())
      })
      describe('restriction values', () => {
        it('should not have duplicate values', () => {
          expect(enumField.annotations[CORE_ANNOTATIONS.VALUES]).toHaveLength(2)
        })
        it('should be sorted alphabetically', () => {
          expect(enumField.annotations[CORE_ANNOTATIONS.VALUES]).toEqual(['a', 'b'])
        })
      })
    })
  })
  describe('getSObjectFieldElement', () => {
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
          // eslint-disable-next-line comma-dangle
          'User'
        ],
        relationshipName: 'Owner',
        restrictedPicklist: false,
        scale: 0,
        searchPrefilterable: false,
        soapType: 'tns:ID',
        sortable: true,
        type: 'reference',
        unique: false,
        // eslint-disable-next-line comma-dangle
        updateable: true
      }

      let salesforceReferenceField: SalesforceField
      beforeEach(() => {
        salesforceReferenceField = _.cloneDeep(origSalesforceReferenceField)
      })

      const dummyElemID = new ElemID('adapter', 'dummy')
      const serviceIds = { [API_NAME]: 'Dummy' }

      const assertReferenceFieldTransformation = (fieldElement: Field, expectedRelatedTo: string[],
        expectedType: TypeElement, expectedAllowLookupRecordDeletion: boolean | undefined,
        expectedLookupFilter: object | undefined):
        void => {
        expect(fieldElement.type).toEqual(expectedType)
        expect(fieldElement.name).toEqual('OwnerId')
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.REFERENCE_TO])
          .toHaveLength(expectedRelatedTo.length)
        expectedRelatedTo.forEach(expectedRelatedToValue =>
          expect(fieldElement.annotations[FIELD_ANNOTATIONS.REFERENCE_TO])
            .toContain(expectedRelatedToValue))
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION])
          .toEqual(expectedAllowLookupRecordDeletion)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER])
          .toEqual(expectedLookupFilter)
      }

      it('should fetch lookup relationships with restricted deletion', async () => {
        _.set(salesforceReferenceField, 'restrictedDelete', true)
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField,
          serviceIds)
        assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.primitiveDataTypes.Lookup, false, undefined)
      })

      it('should fetch lookup relationships with allowed related record deletion when restrictedDelete set to false', async () => {
        _.set(salesforceReferenceField, 'restrictedDelete', false)
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField,
          serviceIds)
        assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.primitiveDataTypes.Lookup, true, undefined)
      })

      it('should fetch lookup relationships with allowed related record deletion when restrictedDelete is undefined', async () => {
        _.set(salesforceReferenceField, 'restrictedDelete', undefined)
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField,
          serviceIds)
        assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.primitiveDataTypes.Lookup, true, undefined)
      })

      it('should fetch masterdetail relationships', async () => {
        salesforceReferenceField.cascadeDelete = true
        salesforceReferenceField.updateable = true
        salesforceReferenceField.writeRequiresMasterRead = true
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField,
          serviceIds)
        assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.primitiveDataTypes.MasterDetail, undefined, undefined)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]).toBe(true)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]).toBe(true)
      })

      it('should fetch masterdetail relationships which are not reparentable and requires read/write access', async () => {
        salesforceReferenceField.cascadeDelete = true
        salesforceReferenceField.updateable = false
        delete salesforceReferenceField.writeRequiresMasterRead
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField, {})
        assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.primitiveDataTypes.MasterDetail, undefined, undefined)
        expect(fieldElement.annotations[CORE_ANNOTATIONS.REQUIRED]).toBe(false)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]).toBe(false)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]).toBe(false)
      })

      it('should fetch lookup filters and init its annotation', async () => {
        _.set(salesforceReferenceField, 'filteredLookupInfo', {})
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField,
          serviceIds)
        assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.primitiveDataTypes.Lookup, true, {})
      })
    })

    describe('field dependency transformation', () => {
      const origFieldDependencyField: SalesforceField = {
        aggregatable: false,
        cascadeDelete: false,
        dependentPicklist: true,
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
        relationshipName: 'Owner',
        restrictedPicklist: false,
        scale: 0,
        searchPrefilterable: false,
        soapType: 'tns:ID',
        sortable: true,
        picklistValues: [
          { active: true, defaultValue: false, value: 'a' },
          { active: true, defaultValue: false, value: 'b' },
        ],
        type: 'picklist',
        unique: false,
        // eslint-disable-next-line comma-dangle
        updateable: true
      }

      let salesforceFieldDependencyField: SalesforceField
      beforeEach(() => {
        salesforceFieldDependencyField = _.cloneDeep(origFieldDependencyField)
      })

      const dummyElemID = new ElemID('adapter', 'dummy')
      const serviceIds = { [API_NAME]: 'Dummy' }

      it('should fetch field dependency and init its annotation for picklist', async () => {
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceFieldDependencyField,
          serviceIds)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]).toEqual({})
        expect(fieldElement.type).toEqual(Types.primitiveDataTypes.Picklist)
      })

      it('should fetch field dependency and init its annotation for multi picklist', async () => {
        salesforceFieldDependencyField.type = 'multipicklist'
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceFieldDependencyField,
          serviceIds)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]).toEqual({})
        expect(fieldElement.type).toEqual(Types.primitiveDataTypes.MultiselectPicklist)
      })

      it('should not init field dependency annotation when having no field dependency ', async () => {
        salesforceFieldDependencyField.dependentPicklist = false
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceFieldDependencyField,
          serviceIds)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]).toBeUndefined()
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
        // eslint-disable-next-line comma-dangle
        updateable: true
      }

      let salesforceRollupSummaryField: SalesforceField
      beforeEach(() => {
        salesforceRollupSummaryField = _.cloneDeep(origRollupSummaryField)
      })

      const dummyElemID = new ElemID('adapter', 'dummy')
      const serviceIds = { [API_NAME]: 'Dummy' }

      it('should fetch rollup summary field', async () => {
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceRollupSummaryField,
          serviceIds)
        expect(fieldElement.type).toEqual(Types.primitiveDataTypes.Summary)
      })

      it('should not fetch summary field if it is a calculated formula', async () => {
        salesforceRollupSummaryField.calculatedFormula = 'dummy formula'
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceRollupSummaryField,
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

      const dummyElemID = new ElemID('adapter', 'dummy')
      const serviceIds = { [API_NAME]: 'Dummy' }

      it('should fetch double field and init its annotations', async () => {
        const precision = 9
        const scale = 6
        salesforceNumberField.precision = precision
        salesforceNumberField.scale = scale
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceNumberField, serviceIds)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.PRECISION]).toEqual(precision)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.SCALE]).toEqual(scale)
        expect(fieldElement.type).toEqual(Types.primitiveDataTypes.Number)
      })

      it('should fetch int field and init its annotations', async () => {
        const precision = 8
        salesforceNumberField.type = 'int'
        salesforceNumberField.digits = precision
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceNumberField, serviceIds)
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.PRECISION]).toEqual(precision)
        expect(fieldElement.type).toEqual(Types.primitiveDataTypes.Number)
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

      const dummyElemID = new ElemID('adapter', 'dummy')
      const serviceIds = { [API_NAME]: 'Dummy' }

      it('should fetch name field with the right type', async () => {
        const fieldElement = getSObjectFieldElement(dummyElemID, salesforceNameField, serviceIds)
        expect(fieldElement.type).toEqual(Types.compoundDataTypes.Name)
      })
    })
  })

  describe('toCustomObject', () => {
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
        customObj = toCustomObject(objType, false)
      })

      it('should transform annotations', () => {
        expect(_.get(customObj, DESCRIPTION)).toEqual('MyDescription')
      })

      it('should not transform blacklisted annotations', () => {
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
          [existingField]: new Field(
            elemID, existingField, Types.primitiveDataTypes.Text, { [API_NAME]: 'Test__c' },
          ),
          [ignoredField]: new Field(
            elemID, ignoredField, Types.primitiveDataTypes.Text, { [API_NAME]: 'Ignored__c' },
          ),
        },
        annotations: {
          [API_NAME]: 'Test__c',
          [METADATA_TYPE]: CUSTOM_OBJECT,
        },
      })

      describe('with fields', () => {
        let customObj: CustomObject
        beforeEach(() => {
          customObj = toCustomObject(
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
          customObj = toCustomObject(objType, false)
        })
        it('should not contain fields', () => {
          expect(customObj.fields).toBeUndefined()
        })
      })
    })

    describe('reference field transformation', () => {
      const relatedTo = ['User', 'Property__c']
      const annotations: Values = {
        [API_NAME]: COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME,
        [LABEL]: 'field_label',
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [FIELD_ANNOTATIONS.REFERENCE_TO]: relatedTo,
      }
      const fieldName = COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME
      const origObjectType = new ObjectType({
        elemID,
        fields: {
          [fieldName]: new TypeField(
            elemID, fieldName, Types.primitiveDataTypes.Lookup, annotations,
          ),
        },
      })
      let objectType: ObjectType
      beforeEach(() => {
        objectType = _.cloneDeep(origObjectType)
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

      it('should transform lookup field with deletion constraint', async () => {
        // eslint-disable-next-line max-len
        objectType.fields[fieldName].annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION] = false
        const customLookupField = toCustomField(objectType.fields[fieldName])
        assertCustomFieldTransformation(customLookupField,
          FIELD_TYPE_NAMES.LOOKUP, 'Name', 'Restrict', relatedTo)
      })

      it('should transform lookup field with no deletion constraint', async () => {
        // eslint-disable-next-line max-len
        objectType.fields[fieldName].annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION] = true
        const customLookupField = toCustomField(objectType.fields[fieldName])
        assertCustomFieldTransformation(customLookupField,
          FIELD_TYPE_NAMES.LOOKUP, 'Name', 'SetNull', relatedTo)
      })

      it('should transform masterdetail field', async () => {
        const masterDetailField = objectType.fields[fieldName]
        masterDetailField.type = Types.primitiveDataTypes.MasterDetail
        masterDetailField.annotations[FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ] = true
        masterDetailField.annotations[FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL] = true
        const customMasterDetailField = toCustomField(masterDetailField)
        assertCustomFieldTransformation(customMasterDetailField,
          FIELD_TYPE_NAMES.MASTER_DETAIL, 'Name', undefined, relatedTo)
        expect(customMasterDetailField.reparentableMasterDetail).toBe(true)
        expect(customMasterDetailField.writeRequiresMasterRead).toBe(true)
      })

      it('should have ControlledByParent sharing model when having masterdetail field', async () => {
        objectType.fields[fieldName].type = Types.primitiveDataTypes.MasterDetail
        const customObjectWithMasterDetailField = toCustomObject(objectType, true)
        expect(customObjectWithMasterDetailField.sharingModel).toEqual('ControlledByParent')
      })

      it('should have ReadWrite sharing model when not having masterdetail field', async () => {
        const customObjectWithMasterDetailField = toCustomObject(objectType, true)
        expect(customObjectWithMasterDetailField.sharingModel).toEqual('ReadWrite')
      })

      it('should have ReadWrite sharing model when not including fields', async () => {
        const customObjectWithMasterDetailField = toCustomObject(objectType, false)
        expect(customObjectWithMasterDetailField.sharingModel).toEqual('ReadWrite')
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
        fields: {
          [fieldName]: new TypeField(elemID, fieldName, Types.primitiveDataTypes.Picklist,
            annotations),
        },
      })
      let obj: ObjectType
      beforeEach(() => {
        obj = _.cloneDeep(origObjectType)
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
        fields: {
          [fieldName]: new TypeField(elemID, fieldName, Types.primitiveDataTypes.Picklist,
            annotations),
        },
      })
      let obj: ObjectType
      beforeEach(() => {
        obj = _.cloneDeep(origObjectType)
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
        fields: {
          [fieldName]: new TypeField(elemID, fieldName, Types.primitiveDataTypes.Summary,
            annotations),
        },
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

  describe('getCompoundChildFields', () => {
    const nameElemID = new ElemID(SALESFORCE, COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME)
    const geoLocationElemID = new ElemID(SALESFORCE, COMPOUND_FIELD_TYPE_NAMES.LOCATION)
    const elemID = new ElemID('salesforce', 'Test')
    const testName = 'Test'

    it('should return sub fields of a compound address field', async () => {
      const fieldName = 'TestAddress'
      const addressElemID = new ElemID(SALESFORCE, COMPOUND_FIELD_TYPE_NAMES.ADDRESS)
      const testedObjectType = new ObjectType({
        elemID,
        fields: {
          [fieldName]: new TypeField(
            addressElemID, fieldName, Types.compoundDataTypes.Address
          ),
        },
      })
      const fields = getCompoundChildFields(testedObjectType)
      expect(fields).toHaveLength(Object.values(Types.compoundDataTypes.Address.fields).length)
      const fieldNamesSet = new Set<string>(fields.map(f => f.name))
      Object.values(ADDRESS_FIELDS).forEach(field => {
        expect(fieldNamesSet).toContain(`${testName}${field}`)
      })
    })

    it('should return sub fields of a compound custom geolocation field', async () => {
      const fieldName = 'Test__c'
      const annotations: Values = {
        [API_NAME]: fieldName,
      }
      const testedObjectType = new ObjectType({
        elemID,
        fields: {
          [fieldName]: new TypeField(
            geoLocationElemID, fieldName, Types.compoundDataTypes.Location, annotations
          ),
        },
      })
      const fields = getCompoundChildFields(testedObjectType)
      expect(fields).toHaveLength(Object.values(Types.compoundDataTypes.Location.fields).length)
      const fieldNamesSet = new Set<string>(fields.map(f => f.name))
      Object.values(GEOLOCATION_FIELDS).forEach(field => {
        const expectedFieldName = `${testName}__${field}`
        expect(fieldNamesSet).toContain(expectedFieldName)
        const apiName = fields.find(
          f => f.name === expectedFieldName
        )?.annotations[API_NAME] as string
        expect(apiName.endsWith('__s')).toBeTruthy()
      })
    })

    it('should return sub fields of a compound non-custom geolocation field', async () => {
      const fieldName = 'Test'
      const annotations: Values = {
        [API_NAME]: fieldName,
      }
      const testedObjectType = new ObjectType({
        elemID,
        fields: {
          [fieldName]: new TypeField(
            geoLocationElemID, fieldName, Types.compoundDataTypes.Location, annotations
          ),
        },
      })
      const fields = getCompoundChildFields(testedObjectType)
      expect(fields).toHaveLength(Object.values(Types.compoundDataTypes.Location.fields).length)
      const fieldNamesSet = new Set<string>(fields.map(f => f.name))
      Object.values(GEOLOCATION_FIELDS).forEach(field => {
        const expectedFieldName = `${testName}__${field}`
        expect(fieldNamesSet).toContain(expectedFieldName)
        const apiName = fields.find(
          f => f.name === expectedFieldName
        )?.annotations[API_NAME] as string
        expect(apiName.endsWith('__s')).toBeFalsy()
      })
    })

    it('should return sub fields of a compound name field', async () => {
      const fieldName = 'Name'
      const annotations: Values = {
        [LABEL]: 'Full Name',
      }
      const testedObjectType = new ObjectType({
        elemID,
        fields: {
          [fieldName]: new TypeField(
            nameElemID, fieldName, Types.compoundDataTypes.Name, annotations
          ),
        },
      })
      const fields = getCompoundChildFields(testedObjectType)
      expect(fields).toHaveLength(Object.values(Types.compoundDataTypes.Name.fields).length)
      const fieldNamesSet = new Set<string>(fields.map(f => f.name))
      Object.values(NAME_FIELDS).forEach(field => {
        expect(fieldNamesSet).toContain(field)
      })
    })

    it('should not return sub fields of a compound name field if it is not a real name field', async () => {
      const fieldName = 'name'
      const annotations: Values = {
        [LABEL]: 'Name',
      }
      const testedObjectType = new ObjectType({
        elemID,
        fields: {
          [fieldName]: new TypeField(
            nameElemID, fieldName, Types.compoundDataTypes.Name, annotations
          ),
        },
      })
      const fields = getCompoundChildFields(testedObjectType)
      expect(fields).toHaveLength(1)
    })
  })

  describe('type definitions', () => {
    it('should include apiName annotation with service_id type', async () => {
      Object.values(Types.getAllFieldTypes()).forEach(type => {
        expect(type.annotationTypes[API_NAME]).toEqual(BuiltinTypes.SERVICE_ID)
      })
    })

    it('should include fieldLevelSecurity annotation with appropriate type', async () => {
      Object.values(Types.getAllFieldTypes()).forEach(type => {
        expect(type.annotationTypes[API_NAME]).toEqual(BuiltinTypes.SERVICE_ID)
        const fieldLevelSecurityType = type.annotationTypes[FIELD_LEVEL_SECURITY_ANNOTATION]
        expect(fieldLevelSecurityType).toBeInstanceOf(ObjectType)
        expect((fieldLevelSecurityType as ObjectType).fields[FIELD_LEVEL_SECURITY_FIELDS.EDITABLE])
          .toBeDefined()
        expect((fieldLevelSecurityType as ObjectType).fields[FIELD_LEVEL_SECURITY_FIELDS.READABLE])
          .toBeDefined()
      })
    })
  })

  describe('create a path with subtype for subtypes', () => {
    let client: SalesforceClient

    beforeEach(() => {
      client = mockClient().client
    })

    const nestedField = {
      fields: [],
      foreignKeyDomain: '',
      isForeignKey: false,
      isNameField: false,
      minOccurs: 0,
      name: 'Nested',
      picklistValues: [],
      soapType: 'NestedFieldType',
      valueRequired: false,
    }
    const field = {
      fields: [nestedField],
      foreignKeyDomain: '',
      isForeignKey: false,
      isNameField: false,
      minOccurs: 0,
      name: 'Field',
      picklistValues: [],
      soapType: 'FieldType',
      valueRequired: false,
    }
    it('should not create a base element as subtype', async () => {
      const [element] = await createMetadataTypeElements(
        'BaseType',
        [],
        new Map<string, TypeElement>(),
        new Set(['BaseType']),
        client,
      )
      expect(element.path).not.toContain(SUBTYPES_PATH)
    })

    it('should create a type which is not a base element as subtype', async () => {
      const [element] = await createMetadataTypeElements(
        'BaseType',
        [],
        new Map<string, TypeElement>(),
        new Set(),
        client,
      )
      expect(element.path).toContain(SUBTYPES_PATH)
    })

    it('should not create a field which is a base element as subtype', async () => {
      client.describeMetadataType = jest.fn()
      const elements = await createMetadataTypeElements(
        'BaseType',
        [field],
        new Map<string, TypeElement>(),
        new Set(['BaseType', 'FieldType', 'NestedFieldType']),
        client,
      )
      expect(elements).toHaveLength(2)
      const [element, fieldType] = elements
      expect(element.path).not.toContain(SUBTYPES_PATH)
      expect(fieldType.path).not.toContain(SUBTYPES_PATH)
      expect(client.describeMetadataType).toHaveBeenCalledTimes(0)
    })

    it('should create a field and nested field which are not a base element as subtype', async () => {
      client.describeMetadataType = jest.fn().mockImplementation(() =>
        Promise.resolve([{
          fields: [],
          name: 'inner',
          picklistValues: [],
          soapType: 'string',
          valueRequired: false,
        }]))
      const elements = await createMetadataTypeElements(
        'BaseType',
        [field],
        new Map<string, TypeElement>(),
        new Set(['BaseType']),
        client,
      )
      expect(elements).toHaveLength(3)
      const [element, fieldType, nestedFieldType] = elements
      expect(element.path).not.toContain(SUBTYPES_PATH)
      expect(fieldType.path).toContain(SUBTYPES_PATH)
      expect(client.describeMetadataType).toHaveBeenCalledTimes(1)
      expect(nestedFieldType.path).toContain(SUBTYPES_PATH)
      expect(nestedFieldType.fields.inner.type).toEqual(BuiltinTypes.STRING)
    })

    it('should create nested field as subtype when nested field has fields', async () => {
      client.describeMetadataType = jest.fn().mockImplementation(() =>
        Promise.resolve([{
          fields: [],
          name: 'inner',
          picklistValues: [],
          soapType: 'string',
          valueRequired: false,
        }]))
      const elements = await createMetadataTypeElements(
        'BaseType',
        [field],
        new Map<string, TypeElement>(),
        new Set(['BaseType', 'FieldType']),
        client,
      )
      expect(elements).toHaveLength(3)
      const [element, fieldType, nestedFieldType] = elements
      expect(element.path).not.toContain(SUBTYPES_PATH)
      expect(fieldType.path).not.toContain(SUBTYPES_PATH)
      expect(nestedFieldType.path).toContain(SUBTYPES_PATH)
      expect(client.describeMetadataType).toHaveBeenCalledTimes(1)
    })

    it('should not create nested field when nested field has no fields', async () => {
      client.describeMetadataType = jest.fn()
      const elements = await createMetadataTypeElements(
        'BaseType',
        [field],
        new Map<string, TypeElement>(),
        new Set(['BaseType', 'FieldType']),
        client,
      )
      expect(elements).toHaveLength(2)
      const [element, fieldType] = elements
      expect(element.path).not.toContain(SUBTYPES_PATH)
      expect(fieldType.path).not.toContain(SUBTYPES_PATH)
      expect(client.describeMetadataType).toHaveBeenCalledTimes(1)
    })

    it('should not create nested field when nested field has no fields and is a picklist', async () => {
      client.describeMetadataType = jest.fn().mockImplementation(() =>
        Promise.resolve([]))
      const elements = await createMetadataTypeElements(
        'BaseType',
        [{
          fields: [],
          foreignKeyDomain: '',
          isForeignKey: false,
          isNameField: false,
          minOccurs: 0,
          name: 'picklistField',
          picklistValues: [
            { active: true, value: 'yes', defaultValue: true },
            { active: true, value: 'no', defaultValue: false },
          ],
          soapType: 'MyPicklist',
          valueRequired: false,
        }],
        new Map<string, TypeElement>(),
        new Set(['BaseType']),
        client,
      )
      expect(elements).toHaveLength(1)
      expect(elements[0].path).not.toContain(SUBTYPES_PATH)
      expect(client.describeMetadataType).toHaveBeenCalledTimes(0)
    })

    it('should not create nested field when nested field has no fields and its name is not capitalized', async () => {
      client.describeMetadataType = jest.fn().mockImplementation(() =>
        Promise.resolve([]))
      const elements = await createMetadataTypeElements(
        'BaseType',
        [{
          fields: [],
          foreignKeyDomain: '',
          isForeignKey: false,
          isNameField: false,
          minOccurs: 0,
          name: 'noUpperCaseTypeName',
          picklistValues: [],
          soapType: 'base64Binary',
          valueRequired: false,
        }],
        new Map<string, TypeElement>(),
        new Set(['BaseType']),
        client,
      )
      expect(elements).toHaveLength(1)
      expect(elements[0].path).not.toContain(SUBTYPES_PATH)
      expect(client.describeMetadataType).toHaveBeenCalledTimes(0)
    })
  })

  describe('transform references to SF lookup value', () => {
    const instanceFullName = 'Instance'
    const objectApiName = 'Object'
    const regValue = 'REG'
    const newValue = 'NEW'
    const elementID = new ElemID('salesforce', 'elememt')
    const element = new ObjectType({
      elemID: elementID,
      annotations: {
        [API_NAME]: objectApiName,
        typeRef: new ReferenceExpression(
          elementID.createNestedID('annotation', API_NAME), objectApiName
        ),
      },
    })

    const instance = new InstanceElement('instance', element, {
      [INSTANCE_FULL_NAME_FIELD]: instanceFullName,
    })
    const valueRef = new ReferenceExpression(instance.elemID.createNestedID('ref'), regValue)
    const instanceRef = new ReferenceExpression(instance.elemID, instance)
    const elementRef = new ReferenceExpression(element.elemID, element)
    const elemID = new ElemID('salesforce', 'base')
    const orig = new ObjectType({
      elemID,
      annotations: {
        instanceRef,
        objectRef: elementRef,
        valueRef,
        reg: regValue,
        changeToRef: regValue,
      },
      fields: {
        field: new Field(elemID, 'field', element, {
          instanceRef,
          objectRef: elementRef,
          valueRef,
          reg: regValue,
          changeToRef: regValue,
        }),
      },
    })
    const origCopy = _.cloneDeep(orig)
    const modified = transformReferences(orig)

    it('should not modify the original element', () => {
      expect(orig).toEqual(origCopy)
    })

    it('should transform element ref values', () => {
      expect(modified.annotations.instanceRef).toEqual(instanceFullName)
      expect(modified.fields.field.annotations.instanceRef).toEqual(instanceFullName)
      expect(modified.annotations.objectRef).toEqual(objectApiName)
      expect(modified.fields.field.annotations.objectRef).toEqual(objectApiName)
      expect(modified.annotations.valueRef).toEqual(regValue)
      expect(modified.fields.field.annotations.valueRef).toEqual(regValue)
      expect(modified.fields.field.annotations.changeToRef).toEqual(regValue)
      expect(modified.annotations.changeToRef).toEqual(regValue)
    })

    it('should transform regular ref values', () => {
      expect(modified.annotations.reg).toEqual(regValue)
      expect(modified.annotations.changeToRef).toEqual(regValue)
      expect(modified.fields.field.annotations.reg).toEqual(regValue)
      expect(modified.fields.field.annotations.changeToRef).toEqual(regValue)
      expect(modified.fields.field.type.annotations.typeRef).toEqual(objectApiName)
    })

    it('should transform back to orig value', () => {
      expect(restoreReferences(orig, modified)).toEqual(orig)
    })

    it('should maintain new values when transforming back to orig value', () => {
      const after = modified.clone()
      after.annotations.new = newValue
      after.fields.field.annotations.new = newValue
      after.annotations.regValue = newValue
      after.fields.field.annotations.regValue = newValue
      after.fields.field.annotations.changeToRef = instanceRef
      after.annotations.changeToRef = instanceRef
      const restored = restoreReferences(orig, after)
      expect(restored.annotations.new).toEqual(newValue)
      expect(restored.fields.field.annotations.new).toEqual(newValue)
      expect(restored.annotations.regValue).toEqual(newValue)
      expect(restored.fields.field.annotations.regValue).toEqual(newValue)
      expect(restored.fields.field.annotations.changeToRef).toEqual(instanceRef)
      expect(restored.annotations.changeToRef).toEqual(instanceRef)
    })
  })
})
