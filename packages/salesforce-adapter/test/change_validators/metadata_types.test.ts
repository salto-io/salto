/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, InstanceElement, toChange, BuiltinTypes, ObjectType, ElemID } from '@salto-io/adapter-api'
import deployNonDeployableTypes from '../../src/change_validators/metadata_types'
import { createMetadataObjectType } from '../../src/transformers/transformer'
import {
  CUSTOM_METADATA,
  CUSTOM_METADATA_TYPE_NAME,
  CUSTOM_OBJECT,
  CUSTOM_OBJECT_TYPE_NAME,
  INSTANCE_FULL_NAME_FIELD,
  METADATA_TYPE,
  SALESFORCE,
} from '../../src/constants'
import { mockTypes } from '../mock_elements'
import { createField } from '../utils'

describe('deployNonDeployableTypes', () => {
  let validatorResult: ReadonlyArray<ChangeError>
  describe('When deploying custom object types', () => {
    beforeEach(async () => {
      validatorResult = await deployNonDeployableTypes([
        toChange({ after: mockTypes.Account }),
        toChange({ after: mockTypes.CustomMetadataRecordType }),
      ])
    })
    it('should not generate errors', () => {
      expect(validatorResult).toBeEmpty()
    })
  })
  describe('When deploying an artificial type', () => {
    const artificialType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'SomeType'),
    })
    beforeEach(async () => {
      validatorResult = await deployNonDeployableTypes([toChange({ after: artificialType })])
    })
    it('should not generate errors', () => {
      expect(validatorResult).toBeEmpty()
    })
  })
  describe('When deploying instances', () => {
    beforeEach(async () => {
      validatorResult = await deployNonDeployableTypes([
        toChange({
          after: new InstanceElement('SomeAccount', mockTypes.Account),
        }),
      ])
    })
    it('should not generate errors', () => {
      expect(validatorResult).toBeEmpty()
    })
  })
  describe('When deploying metadata types', () => {
    const metadataType = createMetadataObjectType({
      annotations: {
        [METADATA_TYPE]: 'SomeMetadataType',
      },
    })
    beforeEach(async () => {
      validatorResult = await deployNonDeployableTypes([toChange({ after: metadataType })])
    })
    it('should generate errors', () => {
      expect(validatorResult).toSatisfyAll(error => error.elemID.isEqual(metadataType.elemID))
    })
  })
  describe('When deploying the CustomObject and CustomMetadata metadata types', () => {
    const customObjectMetadataType = new ObjectType({
      elemID: new ElemID(SALESFORCE, CUSTOM_OBJECT_TYPE_NAME),
      annotations: {
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
      fields: {
        [INSTANCE_FULL_NAME_FIELD]: {
          refType: BuiltinTypes.SERVICE_ID,
        },
      },
    })
    const customMetadataMetadataType = new ObjectType({
      elemID: new ElemID(SALESFORCE, CUSTOM_METADATA_TYPE_NAME),
      annotations: {
        [METADATA_TYPE]: CUSTOM_METADATA,
      },
      fields: {
        [INSTANCE_FULL_NAME_FIELD]: {
          refType: BuiltinTypes.SERVICE_ID,
        },
      },
    })
    beforeEach(async () => {
      validatorResult = await deployNonDeployableTypes([
        toChange({ after: customObjectMetadataType }),
        toChange({ after: customMetadataMetadataType }),
      ])
    })
    it('should generate errors', () => {
      expect(validatorResult).toHaveLength(2)
      const [customObjectError, customMetadataError] = validatorResult
      expect(customObjectError.elemID).toEqual(customObjectMetadataType.elemID)
      expect(customMetadataError.elemID).toEqual(customMetadataMetadataType.elemID)
    })
  })
  describe('When deploying a field change', () => {
    const metadataType = createMetadataObjectType({
      annotations: {
        [METADATA_TYPE]: 'SomeMetadataType',
      },
    })
    const field = createField(metadataType, BuiltinTypes.STRING, 'SomeField')
    beforeEach(async () => {
      validatorResult = await deployNonDeployableTypes([toChange({ after: field })])
    })
    it('should generate errors', () => {
      expect(validatorResult).toSatisfyAll(error => error.elemID.isEqual(metadataType.elemID))
    })
  })
})
