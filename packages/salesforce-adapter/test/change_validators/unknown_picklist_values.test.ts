/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, ElemID, Field, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { types } from '@salto-io/lowerdash'
import changeValidator from '../../src/change_validators/unknown_picklist_values'
import {
  API_NAME,
  FIELD_ANNOTATIONS,
  INSTANCE_FULL_NAME_FIELD,
  SALESFORCE,
  VALUE_SET_FIELDS,
} from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import { createCustomObjectType } from '../utils'
import { mockTypes } from '../mock_elements'

describe('unknownPicklistValues ChangeValidator', () => {
  const TEST_OBJECT_NAME = 'TestObject__c'
  const PICKLIST_FIELD_NAME = 'field__c'
  const ELEMENTS_SOURCE = buildElementsSourceFromElements([])

  let changeErrors: readonly ChangeError[]

  describe('ValueSet', () => {
    const createDataInstanceWithValueSet = (
      allowedValues: types.NonEmptyArray<string>,
      picklistFieldValue?: string | ReferenceExpression,
    ): InstanceElement =>
      new InstanceElement(
        'testInstance',
        createCustomObjectType(TEST_OBJECT_NAME, {
          elemID: new ElemID(SALESFORCE, TEST_OBJECT_NAME),
          fields: {
            [PICKLIST_FIELD_NAME]: {
              refType: Types.primitiveDataTypes.Picklist,
              annotations: {
                [FIELD_ANNOTATIONS.VALUE_SET]: allowedValues.map(allowedValue => ({
                  [INSTANCE_FULL_NAME_FIELD]: allowedValue,
                })),
              },
            },
          },
        }),
        {
          [PICKLIST_FIELD_NAME]: picklistFieldValue,
        },
      )
    describe('when picklist field was set with unknown value', () => {
      beforeEach(async () => {
        const instance = createDataInstanceWithValueSet(['knownValue1', 'knownValue2'], 'unknownValue')
        changeErrors = await changeValidator([toChange({ after: instance })], ELEMENTS_SOURCE)
      })
      it('should create errors', () => {
        expect(changeErrors).toHaveLength(1)
      })
    })
    describe('when picklist field was set with known value', () => {
      beforeEach(async () => {
        const instance = createDataInstanceWithValueSet(['knownValue1', 'knownValue2'], 'knownValue1')
        changeErrors = await changeValidator([toChange({ after: instance })], ELEMENTS_SOURCE)
      })
      it('should not create errors', () => {
        expect(changeErrors).toBeEmpty()
      })
    })
    describe('when picklist field has no value', () => {
      beforeEach(async () => {
        const instance = createDataInstanceWithValueSet(['knownValue1', 'knownValue2'])
        changeErrors = await changeValidator([toChange({ after: instance })], ELEMENTS_SOURCE)
      })
      it('should not create errors', () => {
        expect(changeErrors).toBeEmpty()
      })
    })
    describe('When field value is a Reference to a CustomField', () => {
      const RELATIVE_FIELD_API_NAME = 'TestField__c'
      let referencedField: Field
      beforeEach(() => {
        referencedField = new Field(mockTypes.Account, RELATIVE_FIELD_API_NAME, Types.primitiveDataTypes.Text, {
          [API_NAME]: `Account.${RELATIVE_FIELD_API_NAME}`,
        })
      })
      it('should create error when the referenced field is not in the allowed values', async () => {
        const instance = createDataInstanceWithValueSet(
          ['knownValue1'],
          new ReferenceExpression(referencedField.elemID, referencedField),
        )
        changeErrors = await changeValidator([toChange({ after: instance })], ELEMENTS_SOURCE)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].detailedMessage).toInclude(`Unknown picklist value "${RELATIVE_FIELD_API_NAME}"`)
      })
      it('should not create error when the referenced field is in the allowed values', async () => {
        const instance = createDataInstanceWithValueSet(
          [RELATIVE_FIELD_API_NAME],
          new ReferenceExpression(referencedField.elemID, referencedField),
        )
        changeErrors = await changeValidator([toChange({ after: instance })], ELEMENTS_SOURCE)
        expect(changeErrors).toBeEmpty()
      })
    })
  })
  describe('GlobalValueSet', () => {
    const createDataInstanceWithGlobalValueSet = (
      allowedValues: types.NonEmptyArray<string>,
      picklistFieldValue?: string,
    ): InstanceElement => {
      const globalValueSetInstance = new InstanceElement('globalValueSetInstance', mockTypes.GlobalValueSet, {
        customValue: allowedValues.map(allowedValue => ({
          [INSTANCE_FULL_NAME_FIELD]: allowedValue,
        })),
      })
      const globalValueSetInstanceRef = new ReferenceExpression(globalValueSetInstance.elemID, globalValueSetInstance)
      return new InstanceElement(
        'testInstance',
        createCustomObjectType(TEST_OBJECT_NAME, {
          elemID: new ElemID(SALESFORCE, TEST_OBJECT_NAME),
          fields: {
            [PICKLIST_FIELD_NAME]: {
              refType: Types.primitiveDataTypes.Picklist,
              annotations: {
                [VALUE_SET_FIELDS.VALUE_SET_NAME]: globalValueSetInstanceRef,
              },
            },
          },
        }),
        {
          [PICKLIST_FIELD_NAME]: picklistFieldValue,
        },
      )
    }

    describe('when picklist field was set with unknown value', () => {
      beforeEach(async () => {
        const instance = createDataInstanceWithGlobalValueSet(['knownValue1', 'knownValue2'], 'unknownValue')
        changeErrors = await changeValidator([toChange({ after: instance })], ELEMENTS_SOURCE)
      })
      it('should create errors', () => {
        expect(changeErrors).toHaveLength(1)
      })
    })
    describe('when picklist field was set with known value', () => {
      beforeEach(async () => {
        const instance = createDataInstanceWithGlobalValueSet(['knownValue1', 'knownValue2'], 'knownValue1')
        changeErrors = await changeValidator([toChange({ after: instance })], ELEMENTS_SOURCE)
      })
      it('should not create errors', () => {
        expect(changeErrors).toBeEmpty()
      })
    })
    describe('when picklist field has no value', () => {
      beforeEach(async () => {
        const instance = createDataInstanceWithGlobalValueSet(['knownValue1', 'knownValue2'])
        changeErrors = await changeValidator([toChange({ after: instance })], ELEMENTS_SOURCE)
      })
      it('should not create errors', () => {
        expect(changeErrors).toBeEmpty()
      })
    })
  })
})
