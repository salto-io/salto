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
  ChangeError,
  InstanceElement,
  toChange,
  BuiltinTypes,
  ObjectType,
  ElemID,
} from '@salto-io/adapter-api'
import deployNonDeployableTypes from '../../src/change_validators/metadata_types'
import { createMetadataObjectType } from '../../src/transformers/transformer'
import {
  CUSTOM_METADATA,
  CUSTOM_OBJECT,
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
      validatorResult = await deployNonDeployableTypes([
        toChange({ after: artificialType }),
      ])
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
      validatorResult = await deployNonDeployableTypes([
        toChange({ after: metadataType }),
      ])
    })
    it('should generate errors', () => {
      expect(validatorResult).toSatisfyAll((error) =>
        error.elemID.isEqual(metadataType.elemID),
      )
    })
  })
  describe('When deploying the CustomObject and CustomMetadata metadata types', () => {
    const customObjectMetadataType = createMetadataObjectType({
      annotations: {
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
    })
    const customMetadataMetadataType = createMetadataObjectType({
      annotations: {
        [METADATA_TYPE]: CUSTOM_METADATA,
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
      expect(customMetadataError.elemID).toEqual(
        customMetadataMetadataType.elemID,
      )
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
      validatorResult = await deployNonDeployableTypes([
        toChange({ after: field }),
      ])
    })
    it('should generate errors', () => {
      expect(validatorResult).toSatisfyAll((error) =>
        error.elemID.isEqual(metadataType.elemID),
      )
    })
  })
})
