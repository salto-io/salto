/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  InstanceElement,
  isObjectType,
  ObjectType,
  Element,
  isInstanceElement,
  Change,
  toChange,
  isInstanceChange,
  Field,
  getChangeData,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import filterCreator from '../../src/filters/custom_metadata_to_object_type'
import { defaultFilterContext } from '../utils'
import {
  API_NAME,
  CUSTOM_METADATA,
  CUSTOM_METADATA_SUFFIX,
  CUSTOM_OBJECT,
  DESCRIPTION,
  INSTANCE_FULL_NAME_FIELD,
  INTERNAL_ID_FIELD,
  LABEL,
  METADATA_TYPE,
  PLURAL_LABEL,
  VALIDATION_RULES_METADATA_TYPE,
} from '../../src/constants'
import { mockTypes } from '../mock_elements'
import { apiName, Types } from '../../src/transformers/transformer'
import { apiNameSync, isInstanceOfTypeChangeSync, isInstanceOfTypeSync } from '../../src/filters/utils'
import { FilterWith } from './mocks'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

const { awu } = collections.asynciterable

describe('customMetadataToObjectTypeFilter', () => {
  const CUSTOM_METADATA_RECORD_LABEL = 'MDType'
  const CUSTOM_METADATA_RECORD_INTERNAL_ID = '01I8d0000006OpjEAE'
  const CUSTOM_METADATA_RECORD_TYPE_NAME = 'MDType__mdt'
  const CHECKBOX_FIELD_NAME = 'checkBox__c'
  const PICKLIST_FIELD_NAME = 'picklist__c'
  const CUSTOM_METADATA_DESCRIPTION = 'description test'
  const VALIDATION_RULE_NAME = 'Must_Be_Cool'
  const VALIDATION_RULE_NAME2 = 'Invalid_Name'
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  beforeEach(() => {
    filter = filterCreator({
      config: defaultFilterContext,
    }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  })

  describe('onFetch', () => {
    let customMetadataRecordType: ObjectType
    let afterOnFetchElements: Element[]
    let customMetadataInstance: InstanceElement

    beforeEach(async () => {
      const checkboxField = {
        fullName: CHECKBOX_FIELD_NAME,
        defaultValue: 'false',
        externalId: 'false',
        fieldManageability: 'DeveloperControlled',
        label: 'checkBox',
        type: 'Checkbox',
      }
      const picklistField = {
        fullName: PICKLIST_FIELD_NAME,
        externalId: 'false',
        fieldManageability: 'DeveloperControlled',
        label: 'picklist',
        required: 'false',
        type: 'Picklist',
        valueSet: {
          restricted: 'true',
          valueSetDefinition: {
            sorted: 'false',
            value: [
              {
                fullName: '1',
                default: 'true',
                label: '1',
              },
              {
                fullName: '2',
                default: 'false',
                label: '2',
              },
              {
                fullName: '3',
                default: 'false',
                label: '3',
              },
            ],
          },
        },
      }
      const validationRules = [
        {
          fullName: VALIDATION_RULE_NAME,
          active: true,
          errorConditionFormula: 'Is_Cool__c = false',
          errorMessage: 'This instance is not cool enough',
        },
        {
          fullName: VALIDATION_RULE_NAME2,
          active: true,
          errorConditionFormula: 'Name__c = "invalid"',
          errorMessage: 'Name is invalid',
        },
      ]
      customMetadataInstance = new InstanceElement(CUSTOM_METADATA_RECORD_TYPE_NAME, mockTypes.CustomObject, {
        [INSTANCE_FULL_NAME_FIELD]: CUSTOM_METADATA_RECORD_TYPE_NAME,
        [LABEL]: CUSTOM_METADATA_RECORD_LABEL,
        [PLURAL_LABEL]: `${CUSTOM_METADATA_RECORD_LABEL}s`,
        [INTERNAL_ID_FIELD]: CUSTOM_METADATA_RECORD_INTERNAL_ID,
        fields: [checkboxField, picklistField],
        validationRules,
        [DESCRIPTION]: CUSTOM_METADATA_DESCRIPTION,
      })
      afterOnFetchElements = [customMetadataInstance, mockTypes.CustomMetadata, mockTypes.CustomObject]
      await filter.onFetch(afterOnFetchElements)
      customMetadataRecordType = (await awu(afterOnFetchElements)
        .filter(isObjectType)
        .find(async e => (await apiName(e)) === CUSTOM_METADATA_RECORD_TYPE_NAME)) as ObjectType
      expect(customMetadataRecordType).toBeDefined()
    })
    it('should create type with correct annotations', () => {
      expect(customMetadataRecordType.annotations).toEqual({
        [METADATA_TYPE]: CUSTOM_METADATA,
        [API_NAME]: CUSTOM_METADATA_RECORD_TYPE_NAME,
        [LABEL]: CUSTOM_METADATA_RECORD_LABEL,
        [PLURAL_LABEL]: `${CUSTOM_METADATA_RECORD_LABEL}s`,
        [CORE_ANNOTATIONS.ALIAS]: CUSTOM_METADATA_RECORD_LABEL,
        [DESCRIPTION]: CUSTOM_METADATA_DESCRIPTION,
        [INTERNAL_ID_FIELD]: CUSTOM_METADATA_RECORD_INTERNAL_ID,
      })
    })
    it('should create type with both the RecordType fields and CustomMetadata metadata type fields', () => {
      expect(Object.keys(customMetadataRecordType.fields)).toContainAllValues([
        CHECKBOX_FIELD_NAME,
        PICKLIST_FIELD_NAME,
        ...Object.keys(mockTypes.CustomMetadata.fields),
      ])
    })
    it('should extract sub instances from CustomMetadata type', () => {
      expect(
        afterOnFetchElements
          .filter(isInstanceOfTypeSync(VALIDATION_RULES_METADATA_TYPE))
          .map(instance => apiNameSync(instance, true)),
      ).toIncludeSameMembers([VALIDATION_RULE_NAME, VALIDATION_RULE_NAME2])
    })
    it('should remove the original CustomObject instance', () => {
      expect(afterOnFetchElements.filter(isInstanceElement)).not.toSatisfyAny(e =>
        e.elemID.name.endsWith(CUSTOM_METADATA_SUFFIX),
      )
    })

    describe('Partial Fetch Support - CustomMetadata type does not exist in fetch elements', () => {
      beforeEach(async () => {
        const elements: Element[] = [customMetadataInstance]
        const partialFetchFilter = filterCreator({
          config: {
            ...defaultFilterContext,
            elementsSource: buildElementsSourceFromElements([mockTypes.CustomMetadata]),
            fetchProfile: buildFetchProfile({
              fetchParams: {
                target: ['CustomObject'],
              },
            }),
          },
        }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
        await partialFetchFilter.onFetch(elements)
        customMetadataRecordType = elements
          .filter(isObjectType)
          .find(element => apiNameSync(element) === CUSTOM_METADATA_RECORD_TYPE_NAME) as ObjectType
        expect(customMetadataRecordType).toBeDefined()
      })

      it('should create type with correct annotations', () => {
        expect(customMetadataRecordType.annotations).toEqual({
          [METADATA_TYPE]: CUSTOM_METADATA,
          [API_NAME]: CUSTOM_METADATA_RECORD_TYPE_NAME,
          [LABEL]: CUSTOM_METADATA_RECORD_LABEL,
          [PLURAL_LABEL]: `${CUSTOM_METADATA_RECORD_LABEL}s`,
          [CORE_ANNOTATIONS.ALIAS]: CUSTOM_METADATA_RECORD_LABEL,
          [DESCRIPTION]: CUSTOM_METADATA_DESCRIPTION,
        })
      })
      it('should create type with both the RecordType fields and CustomMetadata metadata type fields', () => {
        expect(Object.keys(customMetadataRecordType.fields)).toContainAllValues([
          CHECKBOX_FIELD_NAME,
          PICKLIST_FIELD_NAME,
          ...Object.keys(mockTypes.CustomMetadata.fields),
        ])
      })
      it('should remove the original CustomObject instance', () => {
        expect(afterOnFetchElements.filter(isInstanceElement)).not.toSatisfyAny(e =>
          e.elemID.name.endsWith(CUSTOM_METADATA_SUFFIX),
        )
      })
    })
  })
  describe('preDeploy and onDeploy', () => {
    let addedField: Field
    let deletedField: Field
    let originalChanges: Change[]
    let afterPreDeployChanges: Change[]
    let afterOnDeployChanges: Change[]
    beforeEach(async () => {
      addedField = new Field(
        mockTypes.CustomMetadataRecordType,
        PICKLIST_FIELD_NAME,
        Types.primitiveDataTypes.Picklist,
        {
          [API_NAME]: `MDType__mdt.${PICKLIST_FIELD_NAME}`,
        },
      )
      deletedField = new Field(
        mockTypes.CustomMetadataRecordType,
        CHECKBOX_FIELD_NAME,
        Types.primitiveDataTypes.Picklist,
        {
          [API_NAME]: `MDType__mdt.${CHECKBOX_FIELD_NAME}}`,
        },
      )
      const fieldAdditionChange = toChange({ after: addedField })
      const fieldDeletionChange = toChange({ before: deletedField })

      originalChanges = [fieldAdditionChange, fieldDeletionChange]
      afterPreDeployChanges = [...originalChanges]
      await filter.preDeploy(afterPreDeployChanges)
      afterOnDeployChanges = [...afterPreDeployChanges]
      await filter.onDeploy(afterOnDeployChanges)
    })

    it('should create a deployable CustomObject instance on preDeploy', () => {
      const customObjectChange = afterPreDeployChanges
        .filter(isInstanceChange)
        .find(isInstanceOfTypeChangeSync(CUSTOM_OBJECT))

      expect(customObjectChange).toBeDefined()
      expect(afterPreDeployChanges).toHaveLength(1)

      const deployableInstance = getChangeData(afterPreDeployChanges[0]) as InstanceElement
      expect(deployableInstance.value[INSTANCE_FULL_NAME_FIELD]).toEqual('MDType__mdt')
      expect(deployableInstance.value.fields).toEqual([
        // Should include the added field only
        { fullName: PICKLIST_FIELD_NAME, required: false, type: 'Picklist' },
      ])
    })
    it('should restore to the original changes on onDeploy', () => {
      expect(afterOnDeployChanges).toEqual(originalChanges)
    })
  })
})
