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
import {
  ObjectType,
  ElemID,
  Field,
  BuiltinTypes,
  TypeElement,
  Field as TypeField,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  InstanceElement,
  getRestriction,
  ListType,
  createRestriction,
  isServiceId,
  createRefToElmWithValue,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { Field as SalesforceField } from '@salto-io/jsforce'
import { resolveValues, restoreValues } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'

import {
  getSObjectFieldElement,
  Types,
  instancesToUpdateRecords,
  getValueTypeFieldElement,
  createMetadataTypeElements,
  MetadataObjectType,
  METADATA_TYPES_TO_RENAME,
  instancesToDeleteRecords,
  instancesToCreateRecords,
  isMetadataObjectType,
  isMetadataInstanceElement,
  toDeployableInstance,
  transformPrimitive,
  getAuthorAnnotations,
  isCustom,
} from '../../src/transformers/transformer'
import { getLookUpName } from '../../src/transformers/reference_mapping'
import {
  FIELD_ANNOTATIONS,
  API_NAME,
  METADATA_TYPE,
  CUSTOM_OBJECT,
  SUBTYPES_PATH,
  INSTANCE_FULL_NAME_FIELD,
  SALESFORCE,
  WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
  WORKFLOW_RULE_METADATA_TYPE,
  WORKFLOW_ACTION_REFERENCE_METADATA_TYPE,
  INTERNAL_ID_FIELD,
  WORKFLOW_ACTION_ALERT_METADATA_TYPE,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  CPQ_PRODUCT_RULE,
  CPQ_LOOKUP_PRODUCT_FIELD,
  BUSINESS_HOURS_METADATA_TYPE,
  SALESFORCE_DATE_PLACEHOLDER,
  FORMULA,
} from '../../src/constants'
import { SalesforceRecord } from '../../src/client/types'
import SalesforceClient from '../../src/client/client'
import Connection from '../../src/client/jsforce'
import mockClient from '../client'
import { defaultFilterContext } from '../utils'
import { LAYOUT_TYPE_ID } from '../../src/filters/layouts'
import {
  mockValueTypeField,
  mockDescribeValueResult,
  mockFileProperties,
  mockSObjectField,
} from '../connection'
import { allMissingSubTypes } from '../../src/transformers/salesforce_types'
import { convertRawMissingFields } from '../../src/transformers/missing_fields'
import { mockTypes } from '../mock_elements'

const { awu } = collections.asynciterable

describe('transformer', () => {
  describe('getAuthorAnnotations', () => {
    const newChangeDateFileProperties = mockFileProperties({
      lastModifiedDate: 'date that is new',
      type: 'test',
      fullName: 'test',
      lastModifiedByName: 'changed_name',
    })
    const oldChangeDateFileProperties = mockFileProperties({
      lastModifiedDate: SALESFORCE_DATE_PLACEHOLDER,
      type: 'test',
      fullName: 'test',
    })
    it('get annotations with up to date change time will return full annotations', () => {
      expect(
        getAuthorAnnotations(newChangeDateFileProperties)[
          CORE_ANNOTATIONS.CHANGED_BY
        ],
      ).toEqual('changed_name')
    })
    it('file properties with old change will return no user name in changedBy', () => {
      expect(
        getAuthorAnnotations(oldChangeDateFileProperties)[
          CORE_ANNOTATIONS.CHANGED_BY
        ],
      ).not.toBeDefined()
    })
  })
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
        enumField = getValueTypeFieldElement(
          dummyElem,
          salesforceEnumField,
          new Map(),
        )
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
        referenceTo: ['Group', 'User'],
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

      const assertReferenceFieldTransformation = async (
        fieldElement: Field,
        expectedRelatedTo: string[],
        expectedType: TypeElement,
      ): Promise<void> => {
        expect(await fieldElement.getType()).toEqual(expectedType)
        expect(fieldElement.name).toEqual('OwnerId')
        expect(
          fieldElement.annotations[FIELD_ANNOTATIONS.REFERENCE_TO],
        ).toHaveLength(expectedRelatedTo.length)
        expectedRelatedTo.forEach((expectedRelatedToValue) =>
          expect(
            fieldElement.annotations[FIELD_ANNOTATIONS.REFERENCE_TO],
          ).toContain(expectedRelatedToValue),
        )
      }

      it('should fetch lookup relationships with restricted deletion', async () => {
        _.set(salesforceReferenceField, 'restrictedDelete', true)
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceReferenceField,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
        await assertReferenceFieldTransformation(
          fieldElement,
          ['Group', 'User'],
          Types.primitiveDataTypes.Lookup,
        )
      })

      it('should fetch lookup relationships with allowed related record deletion when restrictedDelete set to false', async () => {
        _.set(salesforceReferenceField, 'restrictedDelete', false)
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceReferenceField,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
        await assertReferenceFieldTransformation(
          fieldElement,
          ['Group', 'User'],
          Types.primitiveDataTypes.Lookup,
        )
      })

      it('should fetch lookup relationships with allowed related record deletion when restrictedDelete is undefined', async () => {
        _.set(salesforceReferenceField, 'restrictedDelete', undefined)
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceReferenceField,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
        await assertReferenceFieldTransformation(
          fieldElement,
          ['Group', 'User'],
          Types.primitiveDataTypes.Lookup,
        )
      })

      it('should fetch master-detail relationships', async () => {
        salesforceReferenceField.cascadeDelete = true
        salesforceReferenceField.updateable = true
        salesforceReferenceField.writeRequiresMasterRead = true
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceReferenceField,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
        await assertReferenceFieldTransformation(
          fieldElement,
          ['Group', 'User'],
          Types.primitiveDataTypes.MasterDetail,
        )
        expect(
          fieldElement.annotations[
            FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL
          ],
        ).toBe(true)
        expect(
          fieldElement.annotations[
            FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ
          ],
        ).toBe(true)
      })

      it('should fetch master-detail relationships which are not reparentable and requires read/write access', async () => {
        salesforceReferenceField.cascadeDelete = true
        salesforceReferenceField.updateable = false
        delete salesforceReferenceField.writeRequiresMasterRead
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceReferenceField,
          {},
          {},
          defaultFilterContext.fetchProfile,
        )
        await assertReferenceFieldTransformation(
          fieldElement,
          ['Group', 'User'],
          Types.primitiveDataTypes.MasterDetail,
        )
        expect(fieldElement.annotations[CORE_ANNOTATIONS.REQUIRED]).toBeFalsy()
        expect(
          fieldElement.annotations[
            FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL
          ],
        ).toBe(false)
        expect(
          fieldElement.annotations[
            FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ
          ],
        ).toBe(false)
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
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceRollupSummaryField,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
        expect(await fieldElement.getType()).toEqual(
          Types.primitiveDataTypes.Summary,
        )
      })

      it('should not fetch summary field if it is a calculated formula', async () => {
        salesforceRollupSummaryField.calculatedFormula = 'dummy formula'
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceRollupSummaryField,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
        expect(await fieldElement.getType()).not.toEqual(
          Types.primitiveDataTypes.Summary,
        )
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
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceNumberField,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.PRECISION]).toEqual(
          precision,
        )
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.SCALE]).toEqual(scale)
        expect(await fieldElement.getType()).toEqual(
          Types.primitiveDataTypes.Number,
        )
      })

      it('should fetch int field and init its annotations', async () => {
        const precision = 8
        salesforceNumberField.type = 'int'
        salesforceNumberField.digits = precision
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceNumberField,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.PRECISION]).toEqual(
          precision,
        )
        expect(await fieldElement.getType()).toEqual(
          Types.primitiveDataTypes.Number,
        )
      })
    })

    describe('multi-picklist field transformation', () => {
      let field: Field
      beforeEach(() => {
        const fieldDefinition = mockSObjectField({
          custom: true,
          label: 'my_picklist',
          name: 'my_picklist__c',
          soapType: 'xsd:string',
          defaultValueFormula: '"b"',
          type: 'multipicklist',
          picklistValues: [
            { active: true, defaultValue: false, value: 'a' },
            { active: true, defaultValue: false, label: 'b', value: 'b' },
          ],
          restrictedPicklist: true,
          precision: 3,
        })
        field = getSObjectFieldElement(
          dummyElem,
          fieldDefinition,
          {},
          {},
          defaultFilterContext.fetchProfile,
        )
      })
      it('should add value set annotation', () => {
        expect(field.annotations).toHaveProperty(FIELD_ANNOTATIONS.VALUE_SET, [
          { isActive: true, default: false, label: 'a', fullName: 'a' },
          { isActive: true, default: false, label: 'b', fullName: 'b' },
        ])
      })
      it('should set restricted annotation', () => {
        expect(field.annotations).toHaveProperty(
          FIELD_ANNOTATIONS.RESTRICTED,
          true,
        )
      })
      it('should set visible lines according to precision', () => {
        expect(field.annotations).toHaveProperty(
          FIELD_ANNOTATIONS.VISIBLE_LINES,
          3,
        )
      })
    })

    describe('plain textarea field transformation', () => {
      let field: Field
      beforeEach(() => {
        const fieldDefinition = mockSObjectField({
          name: 'longtext__c',
          soapType: 'xsd:string',
          type: 'textarea',
          extraTypeInfo: 'plaintextarea',
          length: 5000,
        })
        field = getSObjectFieldElement(
          dummyElem,
          fieldDefinition,
          {},
          {},
          defaultFilterContext.fetchProfile,
        )
      })
      it('should get long text area field type', () => {
        expect(field.refType.type).toBe(Types.primitiveDataTypes.LongTextArea)
      })
    })
    describe('rich textarea field transformation', () => {
      let field: Field
      beforeEach(() => {
        const fieldDefinition = mockSObjectField({
          name: 'longtext__c',
          soapType: 'xsd:string',
          type: 'textarea',
          extraTypeInfo: 'richtextarea',
          length: 5000,
        })
        field = getSObjectFieldElement(
          dummyElem,
          fieldDefinition,
          {},
          {},
          defaultFilterContext.fetchProfile,
        )
      })
      it('should get html field type', () => {
        expect(field.refType.type).toBe(Types.primitiveDataTypes.Html)
      })
    })
    describe('encrypted string field transformation', () => {
      let field: Field
      beforeEach(() => {
        const fieldDefinition = mockSObjectField({
          name: 'secret__c',
          soapType: 'xsd:string',
          type: 'encryptedstring',
        })
        field = getSObjectFieldElement(
          dummyElem,
          fieldDefinition,
          {},
          {},
          defaultFilterContext.fetchProfile,
        )
      })
      it('should get html field type', () => {
        expect(field.refType.type).toBe(Types.primitiveDataTypes.EncryptedText)
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
          { OtherAddress: 'OtherAddress' },
          defaultFilterContext.fetchProfile,
        )
        expect(await fieldElement.getType()).toEqual(
          Types.compoundDataTypes.Address,
        )
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
      it('should fetch idLookup & typed id fields as serviceId', async () => {
        salesforceIdField = _.cloneDeep(origSalesforceIdField)
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceIdField,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
        expect(isServiceId(await fieldElement.getType())).toEqual(true)
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
        it('Should fetch as AutoNumber field with hidden annotation true and required false', async () => {
          const fieldElement = getSObjectFieldElement(
            dummyElem,
            salesforceAutoNumberField,
            serviceIds,
            {},
            defaultFilterContext.fetchProfile,
          )
          expect(await fieldElement.getType()).toEqual(
            Types.primitiveDataTypes.AutoNumber,
          )
          expect(
            fieldElement.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE],
          ).toBeTruthy()
          expect(
            fieldElement.annotations[CORE_ANNOTATIONS.REQUIRED],
          ).toBeFalsy()
        })
      })

      describe('For nameField', () => {
        it('Should fetch as AutoNumber field with hidden annotation true and required false', async () => {
          salesforceAutoNumberField.nameField = true
          const fieldElement = getSObjectFieldElement(
            dummyElem,
            salesforceAutoNumberField,
            serviceIds,
            {},
            defaultFilterContext.fetchProfile,
          )
          expect(await fieldElement.getType()).toEqual(
            Types.primitiveDataTypes.AutoNumber,
          )
          expect(
            fieldElement.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE],
          ).toBeTruthy()
          expect(
            fieldElement.annotations[CORE_ANNOTATIONS.REQUIRED],
          ).toBeFalsy()
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
          { Name: 'Name' },
          defaultFilterContext.fetchProfile,
        )
        expect(await fieldElement.getType()).toEqual(
          Types.compoundDataTypes.Name,
        )
      })

      it('should fetch name field as text type when no name compound field in object', async () => {
        const fieldElement = getSObjectFieldElement(
          dummyElem,
          salesforceNameField,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
        expect(await fieldElement.getType()).toEqual(
          Types.primitiveDataTypes.Text,
        )
      })
    })
    describe('when field has invalid characters in its name', () => {
      let field: Field
      beforeEach(() => {
        const fieldDefinition: SalesforceField = {
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
          label: 'Invalid%5FName',
          length: 18,
          name: 'Invalid%5FName__c',
          nameField: false,
          namePointing: true,
          nillable: false,
          permissionable: false,
          polymorphicForeignKey: true,
          precision: 0,
          queryByDistance: false,
          restrictedPicklist: false,
          scale: 0,
          searchPrefilterable: false,
          soapType: 'xsd:double',
          sortable: true,
          type: 'currency',
          unique: false,
          updateable: true,
        }
        field = getSObjectFieldElement(
          dummyElem,
          fieldDefinition,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
      })
      it('should create a field with a valid name', () => {
        expect(field.name).not.toInclude('%')
      })
    })

    describe('when field has calculated formula', () => {
      let field: Field
      beforeEach(() => {
        const fieldDefinition = mockSObjectField({
          custom: true,
          label: 'formula',
          name: 'formula__c',
          calculated: true,
          calculatedFormula: 'asd',
          soapType: 'xsd:string',
          type: 'string',
        })
        field = getSObjectFieldElement(
          dummyElem,
          fieldDefinition,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
      })
      it('should have a type of formula', () => {
        expect(field.refType.type?.elemID.name).toEqual('FormulaText')
      })
      it('should have the formula in an annotation', () => {
        expect(field.annotations).toHaveProperty(FORMULA, 'asd')
      })
    })

    describe('when field has a default value with a type', () => {
      let field: Field
      beforeEach(() => {
        const fieldDefinition = mockSObjectField({
          createable: true,
          custom: true,
          filterable: true,
          label: 'yooo',
          name: 'yooo__c',
          nillable: true,
          defaultValue: {
            $: { 'xsi:type': 'xsd:boolean' },
            _: 'true',
          },
          soapType: 'xsd:boolean',
          type: 'boolean',
        })
        field = getSObjectFieldElement(
          dummyElem,
          fieldDefinition,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
      })
      it('should set the _default annotation on the field', () => {
        expect(field.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE]).toEqual(true)
      })
    })
    describe('when field has a default value without a type', () => {
      let field: Field
      beforeEach(() => {
        const fieldDefinition = mockSObjectField({
          createable: true,
          custom: true,
          filterable: true,
          label: 'yooo',
          name: 'yooo__c',
          nillable: false,
          defaultValue: false,
          soapType: 'xsd:boolean',
          type: 'boolean',
          updateable: true,
        })
        field = getSObjectFieldElement(
          dummyElem,
          fieldDefinition,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
        )
      })
      it('should set the _default annotation on the field', () => {
        expect(field.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE]).toEqual(
          false,
        )
      })
    })

    describe('with system field', () => {
      let field: Field
      beforeEach(() => {
        const fieldDefinition = mockSObjectField({
          name: 'LastModifiedDate',
          type: 'datetime',
        })
        field = getSObjectFieldElement(
          dummyElem,
          fieldDefinition,
          serviceIds,
          {},
          defaultFilterContext.fetchProfile,
          ['LastModifiedDate'],
        )
      })
      it('should create a field that is hidden and not required, creatable and updatable', () => {
        expect(field.annotations[CORE_ANNOTATIONS.REQUIRED]).toBeFalsy()
        expect(field.annotations[FIELD_ANNOTATIONS.CREATABLE]).toBeFalsy()
        expect(field.annotations[FIELD_ANNOTATIONS.UPDATEABLE]).toBeFalsy()
        expect(field.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toBeTruthy()
      })
    })
    describe('extendedCustomFieldInformation', () => {
      let fieldDefinition: SalesforceField
      beforeEach(() => {
        fieldDefinition = mockSObjectField({
          name: 'LastModifiedDate',
          type: 'datetime',
          [FIELD_ANNOTATIONS.DEFAULTED_ON_CREATE]: true,
        })
      })
      describe('when feature is enabled', () => {
        it('should return field with extended field information values', () => {
          const field = getSObjectFieldElement(
            dummyElem,
            fieldDefinition,
            serviceIds,
            {},
            {
              ...defaultFilterContext.fetchProfile,
              isFeatureEnabled: (_feature) => true,
            },
          )
          expect(
            field.annotations[FIELD_ANNOTATIONS.DEFAULTED_ON_CREATE],
          ).toEqual(true)
        })
      })
      describe('when feature is disabled', () => {
        it('should return field without extended field information values', () => {
          const field = getSObjectFieldElement(
            dummyElem,
            fieldDefinition,
            serviceIds,
            {},
            {
              ...defaultFilterContext.fetchProfile,
              isFeatureEnabled: (_feature) => false,
            },
          )
          expect(
            field.annotations[FIELD_ANNOTATIONS.DEFAULTED_ON_CREATE],
          ).toBeUndefined()
        })
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
      NotCreatable: 'DoNotSendMeOnCreate',
      Updateable: 'Update',
      NotUpdateable: 'NotUpdateable',
    }
    const instance = new InstanceElement(
      mockInstanceName,
      new ObjectType({
        elemID: mockElemID,
        fields: {
          Id: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          Name: {
            refType: Types.compoundDataTypes.Name,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          LocalAddress: {
            refType: Types.compoundDataTypes.Address,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          LocalLocation: {
            refType: Types.compoundDataTypes.Location,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          NotCreatableNotUpdateableCompound: {
            refType: Types.compoundDataTypes.Address,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: false,
              [FIELD_ANNOTATIONS.CREATABLE]: false,
            },
          },
          Creatable: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          NotCreatable: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: false,
            },
          },
          Updateable: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: true,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
          NotUpdateable: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [FIELD_ANNOTATIONS.UPDATEABLE]: false,
              [FIELD_ANNOTATIONS.CREATABLE]: true,
            },
          },
        },
        annotationRefsOrTypes: {},
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
        expect(
          recordResult[0].NotCreatableNotUpdateableCompound,
        ).toBeUndefined()
      })
    })

    describe('instancesToCreateRecords', () => {
      let recordResult: SalesforceRecord[]
      beforeEach(async () => {
        recordResult = await instancesToCreateRecords([instance])
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
        expect(
          recordResult[0].NotCreatableNotUpdateableCompound,
        ).toBeUndefined()
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
        expect(recordResult[0].LocalLongitude).toEqual(
          values.LocalLocation.Longitude,
        )
        expect(recordResult[0].LocalLatitude).toBeDefined()
        expect(recordResult[0].LocalLatitude).toEqual(
          values.LocalLocation.Latitude,
        )
      })
    })

    describe('instancesToUpdateRecords', () => {
      let recordResult: SalesforceRecord[]
      beforeEach(async () => {
        recordResult = await instancesToUpdateRecords([instance], true)
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
        expect(
          recordResult[0].NotCreatableNotUpdateableCompound,
        ).toBeUndefined()
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
        expect(recordResult[0].LocalLongitude).toEqual(
          values.LocalLocation.Longitude,
        )
        expect(recordResult[0].LocalLatitude).toBeDefined()
        expect(recordResult[0].LocalLatitude).toEqual(
          values.LocalLocation.Latitude,
        )
      })
    })
  })

  describe('type definitions', () => {
    it('should include apiName annotation with service_id type', async () => {
      await awu(Object.values(Types.getAllFieldTypes())).forEach(
        async (type) => {
          expect(
            isServiceId((await type.getAnnotationTypes())[API_NAME]),
          ).toEqual(true)
        },
      )
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
      connection.metadata.describeValueType.mockResolvedValue(
        mockDescribeValueResult({
          valueTypeFields: [{ name: 'inner', soapType: 'string' }],
        }),
      )
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
      expect(await nestedFieldType.fields.inner.getType()).toEqual(
        BuiltinTypes.STRING,
      )
    })

    it('should create nested field as subtype when nested field has fields', async () => {
      connection.metadata.describeValueType.mockResolvedValue(
        mockDescribeValueResult({
          valueTypeFields: [{ name: 'inner', soapType: 'string' }],
        }),
      )
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
        fields: [
          mockValueTypeField({
            name: 'picklistField',
            picklistValues: [
              { active: true, value: 'yes', defaultValue: true },
              { active: true, value: 'no', defaultValue: false },
            ],
            soapType: 'MyPicklist',
          }),
        ],
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
        fields: [
          mockValueTypeField({
            name: 'noUpperCaseTypeName',
            soapType: 'base64Binary',
          }),
        ],
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
        soapType: 'FieldWithNestedTypeReference',
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
      expect(
        fieldWithNestedRef.fields[referenceField.name].annotations
          ?.foreignKeyDomain,
      ).toEqual(['ReferencedTypeName'])
    })

    it('should add a reference if the field is a foreign key with a few options', async () => {
      // assigning foreignKeyDomain separately because the salesforce type incorrectly specifies
      // it as string when it can also be string[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const referenceField: any = mockValueTypeField({
        name: 'FKRef',
        soapType: 'FKRefFieldType',
        isForeignKey: true,
      })
      referenceField.foreignKeyDomain = [
        'ReferencedTypeName',
        'OtherReferencedTypeName',
      ]
      const elements = await createMetadataTypeElements({
        name: 'BaseType',
        fields: [referenceField],
        baseTypeNames: new Set(['BaseType']),
        childTypeNames: new Set(),
        client,
      })
      expect(elements).toHaveLength(1)
      const baseField = elements[0]
      expect(
        baseField.fields[referenceField.name].annotations?.foreignKeyDomain,
      ).toEqual(['ReferencedTypeName', 'OtherReferencedTypeName'])
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
      connection.metadata.describeValueType.mockImplementation(
        async (typeName) =>
          typeName.endsWith('ComplexType')
            ? mockDescribeValueResult({
                valueTypeFields: [
                  mockValueTypeField({ name: 'compField', soapType: 'string' }),
                ],
              })
            : mockDescribeValueResult({ valueTypeFields: [] }),
      )
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
      const elementsByTypeName = _.keyBy(
        elements,
        (elem) => elem.elemID.typeName,
      )
      baseType = elementsByTypeName.BaseType
      complexType = elementsByTypeName.ComplexType
      emptyComplexType = elementsByTypeName.ComplexTypeEmpty

      expect(baseType).toBeDefined()
      expect(complexType).toBeDefined()
      expect(emptyComplexType).toBeDefined()
    })
    it('should keep existing fields', () => {
      expect(baseType.fields).toHaveProperty(
        'normal',
        expect.objectContaining({
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        }),
      )
      expect(complexType.fields).toHaveProperty(
        'compField',
        expect.objectContaining({
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        }),
      )
    })
    it('should add missing fields with builtin types', () => {
      expect(baseType.fields).toHaveProperty(
        'str',
        expect.objectContaining({
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        }),
      )
      expect(baseType.fields).toHaveProperty(
        'num',
        expect.objectContaining({
          refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
        }),
      )
    })
    it('should add missing boolean fields', () => {
      expect(baseType.fields).toHaveProperty(
        'bool1',
        expect.objectContaining({
          refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        }),
      )
      expect(baseType.fields).toHaveProperty(
        'bool2',
        expect.objectContaining({
          refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        }),
      )
    })
    it('should add missing enum fields', () => {
      expect(baseType.fields).toHaveProperty(
        'enum',
        expect.objectContaining({
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: expect.objectContaining({
            [CORE_ANNOTATIONS.RESTRICTION]: expect.objectContaining(
              createRestriction({ values: ['v1', 'v2'] }),
            ),
          }),
        }),
      )
    })
    it('should add complex fields with recursive describe calls', () => {
      expect(connection.metadata.describeValueType).toHaveBeenCalledWith(
        expect.stringMatching(/.*ComplexType$/),
      )
      expect(complexType.fields).toHaveProperty(
        'str',
        expect.objectContaining({
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        }),
      )
    })
    it('should add complex fields even when describe on them is empty', () => {
      expect(connection.metadata.describeValueType).toHaveBeenCalledWith(
        expect.stringMatching(/.*ComplexTypeEmpty$/),
      )
      expect(emptyComplexType.fields).toHaveProperty(
        'str',
        expect.objectContaining({
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        }),
      )
    })
  })

  describe('transform references to SF lookup value', () => {
    const instanceFullName = 'Instance'
    const objectApiName = 'Object'
    const regValue = 'REG'
    const newValue = 'NEW'

    const elementID = new ElemID('salesforce', 'element')

    const typeRef = new ReferenceExpression(
      elementID.createNestedID('annotation', API_NAME),
      objectApiName,
    )

    const element = new ObjectType({
      elemID: elementID,
      annotationRefsOrTypes: {
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
    const valueRef = new ReferenceExpression(
      instance.elemID.createNestedID('ref'),
      regValue,
      instance,
    )
    const instanceRef = new ReferenceExpression(
      instance.elemID,
      instance,
      instance,
    )
    const elementRef = new ReferenceExpression(element.elemID, element, element)
    const elemID = new ElemID('salesforce', 'base')
    const orig = new ObjectType({
      elemID,
      annotationRefsOrTypes: {
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
          refType: element,
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
    let modified: ObjectType
    beforeAll(async () => {
      modified = await resolveValues(orig, getLookUpName)
    })

    it('should not modify the original element', () => {
      expect(orig).toEqual(origCopy)
    })

    it('should transform element ref values', () => {
      expect(modified.annotations.instanceRef).toEqual(instanceFullName)
      expect(modified.annotations.objectRef).toEqual(objectApiName)
      expect(modified.annotations.valueRef).toEqual(regValue)
      expect(modified.annotations.changeToRef).toEqual(regValue)

      expect(modified.fields.field.annotations.instanceRef).toEqual(
        instanceFullName,
      )
      expect(modified.fields.field.annotations.objectRef).toEqual(objectApiName)
      expect(modified.fields.field.annotations.valueRef).toEqual(regValue)
      expect(modified.fields.field.annotations.changeToRef).toEqual(regValue)
    })

    it('should transform regular ref values', async () => {
      expect(modified.annotations.reg).toEqual(regValue)
      expect(modified.annotations.changeToRef).toEqual(regValue)
      expect(modified.fields.field.annotations.reg).toEqual(regValue)
      expect(modified.fields.field.annotations.changeToRef).toEqual(regValue)

      // Should not resolve field type annotations
      expect(
        (await modified.fields.field.getType()).annotations.typeRef,
      ).toEqual(typeRef)
    })

    it('should transform back to orig value', async () => {
      expect(await restoreValues(orig, modified, getLookUpName)).toEqual(orig)
    })

    it('should maintain new values when transforming back to orig value', async () => {
      const after = modified.clone()
      after.annotations.new = newValue
      after.fields.field.annotations.new = newValue
      after.annotations.regValue = newValue
      after.fields.field.annotations.regValue = newValue
      after.fields.field.annotations.changeToRef = instanceRef
      after.annotations.changeToRef = instanceRef
      const restored = await restoreValues(orig, after, getLookUpName)
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
      fields: {
        test: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [API_NAME]: 'Lead.Test__c',
          },
        },
      },
    })
    describe('with references to map values', () => {
      const mockResolvedValue = {
        name: 'Default',
        fridayEndTime: '00:00:00.000Z',
      }
      const mockBusinessHoursSettingsType = new ObjectType({
        elemID: new ElemID(SALESFORCE, BUSINESS_HOURS_METADATA_TYPE),
        annotations: {
          [METADATA_TYPE]: BUSINESS_HOURS_METADATA_TYPE,
        },
      })
      const mockEntitlementProcessType = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'EntitlementProcess'),
        fields: {
          businessHours: {
            refType: allMissingSubTypes[0],
          },
        },
        annotations: {
          [METADATA_TYPE]: 'EntitlementProcess',
        },
      })
      const mockBusinessHoursInstance = new InstanceElement(
        'BusinessHours',
        mockBusinessHoursSettingsType,
      )
      const testField = new Field(
        mockEntitlementProcessType,
        'businessHours',
        BuiltinTypes.STRING,
      )
      const mockDefaultElemId = new ElemID(
        SALESFORCE,
        BUSINESS_HOURS_METADATA_TYPE,
        'instance',
        'Default',
      )
      it('should resolve with mapKey strategy', async () => {
        expect(
          await getLookUpName({
            ref: new ReferenceExpression(
              mockDefaultElemId,
              mockResolvedValue,
              mockBusinessHoursInstance,
            ),
            field: testField,
            path: new ElemID(
              SALESFORCE,
              'EntitlementProcess',
              'field',
              'something',
            ),
            element: new ObjectType({
              elemID: new ElemID(SALESFORCE, 'EntitlementProcess'),
            }),
          }),
        ).toEqual('Default')
      })
    })

    describe('with fields in layout instance', () => {
      const mockLayoutItem = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'LayoutItem'),
        fields: { field: { refType: BuiltinTypes.STRING } },
        annotations: { [METADATA_TYPE]: 'LayoutItem' },
      })
      const mockLayoutColumn = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'LayoutColumn'),
        fields: { layoutItems: { refType: new ListType(mockLayoutItem) } },
        annotations: { [METADATA_TYPE]: 'LayoutColumn' },
      })
      const mockLayoutSection = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'LayoutSection'),
        fields: {
          layoutColumns: { refType: new ListType(mockLayoutColumn) },
        },
        annotations: { [METADATA_TYPE]: 'LayoutSection' },
      })
      const mockLayoutType = new ObjectType({
        elemID: LAYOUT_TYPE_ID,
        fields: {
          layoutSections: { refType: new ListType(mockLayoutSection) },
        },
        annotations: { [METADATA_TYPE]: LAYOUT_TYPE_ID_METADATA_TYPE },
      })
      const mockLayoutInstance = new InstanceElement('test', mockLayoutType, {})
      it('should resolve to relative api name', async () => {
        const testField = refObject.fields.test
        expect(
          await getLookUpName({
            ref: new ReferenceExpression(
              testField.elemID,
              testField,
              refObject,
            ),
            field: mockLayoutItem.fields.field,
            path: mockLayoutInstance.elemID.createNestedID(
              'layoutSections',
              '0',
              'layoutColumns',
              '0',
              'layoutItems',
              '0',
              'field',
            ),
            element: mockLayoutInstance,
          }),
        ).toEqual('Test__c')
      })
      it('should resolve to current value if referenced value is not an element', async () => {
        const testField = refObject.fields.test
        const refValue = { obj: { with: { some: 'details' } } }
        expect(
          await getLookUpName({
            ref: new ReferenceExpression(testField.elemID, refValue),
            field: mockLayoutItem.fields.field,
            path: mockLayoutInstance.elemID.createNestedID(
              'layoutSections',
              '0',
              'layoutColumns',
              '0',
              'layoutItems',
              '0',
              'field',
            ),
            element: mockLayoutInstance,
          }),
        ).toEqual(refValue)
        expect(
          await getLookUpName({
            ref: new ReferenceExpression(testField.elemID, refValue),
            field: mockLayoutItem.fields.field,
            element: mockLayoutInstance,
          }),
        ).toEqual(refValue)
      })
    })
    describe('with fields in workflow field update instance', () => {
      const workflowFieldUpdate = new ObjectType({
        elemID: new ElemID(SALESFORCE, WORKFLOW_FIELD_UPDATE_METADATA_TYPE),
        fields: { field: { refType: BuiltinTypes.STRING } },
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
      it('should resolve to relative api name', async () => {
        const testField = refObject.fields.test
        expect(
          await getLookUpName({
            ref: new ReferenceExpression(
              testField.elemID,
              testField,
              refObject,
            ),
            field: workflowFieldUpdate.fields.field,
            path: mockWorkflowFieldUpdateInstance.elemID.createNestedID(
              'field',
            ),
            element: mockWorkflowFieldUpdateInstance,
          }),
        ).toEqual('Test__c')
      })
    })
    describe('with field in under FilterItem fields and element as context', () => {
      const filterItemType = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'FilterItem'),
        annotations: { [METADATA_TYPE]: 'FilterItem' },
        fields: {
          // note: does not exactly match the real type
          field: { refType: BuiltinTypes.STRING },
        },
      })
      describe('with field in SharingRules instance and element as context', () => {
        const sharingRulesType = new ObjectType({
          elemID: new ElemID(SALESFORCE, 'SharingRules'),
          annotations: { [METADATA_TYPE]: 'SharingRules' },
          fields: {
            someFilterField: { refType: filterItemType },
          },
        })
        const instance = new InstanceElement(
          'rule111',
          sharingRulesType,
          {},
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [
              new ReferenceExpression(new ElemID(SALESFORCE, 'Lead')),
            ],
          },
        )
        it('should resolve to relative api name', async () => {
          const testField = refObject.fields.test
          expect(
            await getLookUpName({
              ref: new ReferenceExpression(
                testField.elemID,
                testField,
                refObject,
              ),
              field: filterItemType.fields.field,
              path: instance.elemID.createNestedID('someFilterField', 'field'),
              element: instance,
            }),
          ).toEqual('Test__c')
        })
      })
      describe('with field in non-SharingRules instance and element as context', () => {
        const nonSharingRulesType = new ObjectType({
          elemID: new ElemID(SALESFORCE, 'NonSharingRules'),
          annotations: { [METADATA_TYPE]: 'NonSharingRules' },
          fields: {
            someFilterField: { refType: filterItemType },
          },
        })
        const instance = new InstanceElement(
          'rule222',
          nonSharingRulesType,
          {},
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [
              new ReferenceExpression(new ElemID(SALESFORCE, 'Lead')),
            ],
          },
        )
        it('should resolve to absolute api name', async () => {
          const testField = refObject.fields.test
          expect(
            await getLookUpName({
              ref: new ReferenceExpression(
                testField.elemID,
                testField,
                refObject,
              ),
              field: filterItemType.fields.field,
              path: instance.elemID.createNestedID('someFilterField', 'field'),
              element: instance,
            }),
          ).toEqual('Lead.Test__c')
        })
      })
    })
    describe('with fields in product_rule (custom object) lookup_product_field update instance', () => {
      const mockProductRuleType = new ObjectType({
        elemID: new ElemID(SALESFORCE, CPQ_PRODUCT_RULE),
        fields: {
          [CPQ_LOOKUP_PRODUCT_FIELD]: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          [METADATA_TYPE]: CUSTOM_OBJECT,
          [API_NAME]: CPQ_PRODUCT_RULE,
        },
      })
      const testField = refObject.fields.test
      const mockProductRuleInst = new InstanceElement(
        'mockProductRule',
        mockProductRuleType,
        {
          [CPQ_LOOKUP_PRODUCT_FIELD]: new ReferenceExpression(
            testField.elemID,
            testField,
            refObject,
          ),
        },
      )
      it('should resolve to relative api name', async () => {
        expect(
          await getLookUpName({
            ref: mockProductRuleInst.value[CPQ_LOOKUP_PRODUCT_FIELD],
            field: mockProductRuleType.fields[CPQ_LOOKUP_PRODUCT_FIELD],
            path: mockProductRuleInst.elemID.createNestedID(
              CPQ_LOOKUP_PRODUCT_FIELD,
            ),
            element: mockProductRuleInst,
          }),
        ).toEqual('Test__c')
      })
    })
    describe('with fields in workflow rule instance', () => {
      const workflowActionReference = new ObjectType({
        elemID: new ElemID(SALESFORCE, WORKFLOW_ACTION_REFERENCE_METADATA_TYPE),
        fields: {
          name: { refType: BuiltinTypes.STRING },
          type: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          [METADATA_TYPE]: WORKFLOW_ACTION_REFERENCE_METADATA_TYPE,
        },
      })
      const workflowRule = new ObjectType({
        elemID: new ElemID(SALESFORCE, WORKFLOW_RULE_METADATA_TYPE),
        fields: { actions: { refType: workflowActionReference } },
        annotations: { [METADATA_TYPE]: WORKFLOW_RULE_METADATA_TYPE },
      })
      const mockWorkflowRuleInstance = new InstanceElement(
        'User_rule1',
        workflowRule,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'User.rule1',
          actions: [
            {
              name: 'alert1',
              type: 'Alert',
            },
          ],
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
      it('should resolve to relative api name', async () => {
        expect(
          await getLookUpName({
            ref: new ReferenceExpression(
              mockAlertInstance.elemID,
              mockAlertInstance,
            ),
            field: workflowActionReference.fields.name,
            path: mockWorkflowRuleInstance.elemID.createNestedID(
              'actions',
              '0',
              'name',
            ),
            element: mockWorkflowRuleInstance,
          }),
        ).toEqual('alert1')
      })
    })
    describe('when field is not specified', () => {
      const srcObject = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'test'),
        fields: { test: { refType: BuiltinTypes.STRING } },
        annotations: { [METADATA_TYPE]: 'test' },
      })
      const srcInst = new InstanceElement('test', srcObject, {})
      it('should resolve to full api name', async () => {
        const testField = refObject.fields.test
        expect(
          await getLookUpName({
            ref: new ReferenceExpression(
              testField.elemID,
              testField,
              refObject,
            ),
            path: srcInst.elemID.createNestedID('test'),
            element: srcInst,
          }),
        ).toEqual('Lead.Test__c')
      })
    })
    describe('with all other cases', () => {
      const srcObject = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'test'),
        fields: { test: { refType: BuiltinTypes.STRING } },
        annotations: { [METADATA_TYPE]: 'test' },
      })
      const srcInst = new InstanceElement('test', srcObject, {})
      it('should resolve to full api name', async () => {
        const testField = refObject.fields.test
        expect(
          await getLookUpName({
            ref: new ReferenceExpression(
              testField.elemID,
              testField,
              refObject,
            ),
            field: srcObject.fields.test,
            path: srcInst.elemID.createNestedID('test'),
            element: srcInst,
          }),
        ).toEqual('Lead.Test__c')
      })
    })
  })
  describe('Renaming metadata type tests', () => {
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
    const nonMdType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'test2'),
    })
    describe('isMetadataObjectType', () => {
      it('should return true for metadata object types', () => {
        expect(isMetadataObjectType(mdType)).toBeTruthy()
      })
      it('should return false for other object types', () => {
        expect(isMetadataObjectType(nonMdType)).toBeFalsy()
      })
    })
    describe('await isMetadataInstanceElement', () => {
      it('should return true for metadata instances', async () => {
        expect(
          await isMetadataInstanceElement(
            new InstanceElement('test', mdType, {
              [INSTANCE_FULL_NAME_FIELD]: 'test',
            }),
          ),
        ).toBeTruthy()
      })
      it('should return false for instance of non metadata types', async () => {
        expect(
          await isMetadataInstanceElement(
            new InstanceElement('test', nonMdType, {
              [INSTANCE_FULL_NAME_FIELD]: 'test',
            }),
          ),
        ).toBeFalsy()
      })
      it('should return false for instances without a fullName', async () => {
        expect(
          await isMetadataInstanceElement(
            new InstanceElement('test', mdType, {}),
          ),
        ).toBeFalsy()
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
      NotCreatable: 'DoNotSendMeOnCreate',
      Updateable: 'Update',
      NotUpdateable: 'NotUpdateable',
      // Used to validate we don't parse Elements if for some reason we reach this flow.
      ElementField: mockTypes.User,
    }
    let instance: InstanceElement
    let res: InstanceElement

    beforeEach(async () => {
      instance = new InstanceElement(
        mockInstanceName,
        new ObjectType({
          elemID: mockElemID,
          fields: {
            Id: {
              refType: BuiltinTypes.STRING,
              annotations: {
                [FIELD_ANNOTATIONS.LOCAL_ONLY]: true,
              },
            },
            Name: {
              refType: Types.compoundDataTypes.Name,
            },
            LocalAddress: {
              refType: Types.compoundDataTypes.Address,
              annotations: {
                [FIELD_ANNOTATIONS.LOCAL_ONLY]: true,
                [FIELD_ANNOTATIONS.UPDATEABLE]: true,
                [FIELD_ANNOTATIONS.CREATABLE]: true,
              },
            },
          },
          annotationRefsOrTypes: {},
          annotations: { [METADATA_TYPE]: CUSTOM_OBJECT },
        }),
        values,
      )
      res = await toDeployableInstance(instance)
    })

    it('should hide local-only field', () => {
      expect(instance.value.Id).toBeDefined()
      expect(instance.value.Name).toBeDefined()
      expect(instance.value.LocalAddress).toBeDefined()
      expect(res.value.Id).toBeUndefined()
      expect(res.value.Name).toBeDefined()
      expect(res.value.LocalAddress).toBeUndefined()
      expect(res.value.ElementField).toBeUndefined()
    })
  })

  describe('transformPrimitive', () => {
    let mockObjType: ObjectType
    beforeAll(() => {
      mockObjType = new ObjectType({
        elemID: new ElemID('test', 'obj'),
        fields: {
          str: { refType: BuiltinTypes.STRING },
          num: { refType: BuiltinTypes.NUMBER },
          bool: { refType: BuiltinTypes.BOOLEAN },
          obj: {
            refType: new ObjectType({ elemID: new ElemID('test', 'nested') }),
          },
          unknown: { refType: BuiltinTypes.UNKNOWN },
        },
      })
    })
    describe('with primitive field', () => {
      it('should convert number type', () => {
        expect(
          transformPrimitive({ value: '1', field: mockObjType.fields.num }),
        ).toEqual(1)
      })
      it('should convert string type', () => {
        expect(
          transformPrimitive({ value: '1', field: mockObjType.fields.str }),
        ).toEqual('1')
      })
      it('should convert boolean type', () => {
        expect(
          transformPrimitive({ value: 'true', field: mockObjType.fields.bool }),
        ).toEqual(true)
      })
      it('should leave unknown type as-is', () => {
        expect(
          transformPrimitive({ value: '1', field: mockObjType.fields.unknown }),
        ).toEqual('1')
        expect(
          transformPrimitive({ value: 1, field: mockObjType.fields.unknown }),
        ).toEqual(1)
      })
      it('should convert values with xsi:type attribute', () => {
        expect(
          transformPrimitive({
            value: { _: 'true', $: { 'xsi:type': 'xsd:boolean' } },
            field: mockObjType.fields.bool,
          }),
        ).toEqual(true)
        expect(
          transformPrimitive({
            value: { _: '12.3', $: { 'xsi:type': 'xsd:double' } },
            field: mockObjType.fields.num,
          }),
        ).toEqual(12.3)
      })
      it('should convert value by field type if xsi:type is unrecognized', () => {
        expect(
          transformPrimitive({
            value: { _: 'true', $: { 'xsi:type': 'xsd:unknown' } },
            field: mockObjType.fields.bool,
          }),
        ).toEqual(true)
        expect(
          transformPrimitive({
            value: { _: 'true', $: { 'xsi:type': 'xsd:unknown' } },
            field: mockObjType.fields.str,
          }),
        ).toEqual('true')
      })
      it('should omit null values', () => {
        expect(
          transformPrimitive({
            value: { $: { 'xsi:nil': 'true' } },
            field: mockObjType.fields.bool,
          }),
        ).toBeUndefined()
      })
      it('should not transform object types', () => {
        expect(
          transformPrimitive({
            value: { bla: 'foo' },
            field: mockObjType.fields.obj,
          }),
        ).toEqual({ bla: 'foo' })
      })
      it('should not transform object values', () => {
        expect(
          transformPrimitive({
            value: { bla: 'foo' },
            field: mockObjType.fields.string,
          }),
        ).toEqual({ bla: 'foo' })
      })
    })
  })
  describe('isCustom', () => {
    it('should return true for custom apiNames', () => {
      expect(isCustom('Custom__c')).toBeTrue()
    })
    it('should return false for undefined', () => {
      expect(isCustom(undefined)).toBeFalse()
    })
    it('should return false for standard apiNames', () => {
      expect(isCustom('Name')).toBeFalse()
    })
  })
})
