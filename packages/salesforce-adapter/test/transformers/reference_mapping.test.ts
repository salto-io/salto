/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, InstanceElement, ListType, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { resolveValues } from '@salto-io/adapter-components'

import { mockTypes } from '../mock_elements'
import { getLookUpName, getLookupNameForDataInstances } from '../../src/transformers/reference_mapping'
import {
  CUSTOM_OBJECT_ID_FIELD,
  ELEMENT_REFERENCE,
  FLOW_ELEMENT_REFERENCE_OR_VALUE,
  FLOW_FIELD_TYPE_NAMES,
  FLOW_METADATA_TYPE,
} from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { createInstanceElement, createMetadataObjectType } from '../../src/transformers/transformer'
import { FetchProfile } from '../../src/types'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('referenceMapping tests', () => {
  const FIRST_PRODUCT_ID = '1t0d00000000001AAA'
  const SECOND_PRODUCT_ID = '1t0d00000000001BBB'
  const FIELD_NAME = 'Product__c'

  let firstProduct: InstanceElement
  let secondProduct: InstanceElement
  let getLookupNameFunc: GetLookupNameFunc

  beforeEach(() => {
    firstProduct = new InstanceElement('Product1', mockTypes.Product2, {
      Name: 'Product1',
    })
    secondProduct = new InstanceElement('Product2', mockTypes.Product2, {
      Name: 'Product2',
    })
    firstProduct.value[FIELD_NAME] = new ReferenceExpression(secondProduct.elemID, secondProduct)
    secondProduct.value[FIELD_NAME] = new ReferenceExpression(firstProduct.elemID, firstProduct)
  })

  describe('getLookUpNameImpl', () => {
    let flowInstance: InstanceElement
    let accountInstance: InstanceElement
    let fetchProfile: FetchProfile
    let flowElementReferenceOrValue: ObjectType
    let flow: ObjectType
    beforeEach(() => {
      fetchProfile = buildFetchProfile({ fetchParams: {} })
      flowElementReferenceOrValue = createMetadataObjectType({
        annotations: { metadataType: FLOW_ELEMENT_REFERENCE_OR_VALUE },
        fields: {
          [ELEMENT_REFERENCE]: {
            refType: BuiltinTypes.STRING,
          },
        },
      })
      flow = createMetadataObjectType({
        annotations: {
          metadataType: FLOW_METADATA_TYPE,
        },
        fields: {
          assignments: {
            refType: new ListType(
              createMetadataObjectType({
                annotations: { metadataType: FLOW_FIELD_TYPE_NAMES.FLOW_ASSIGNMENT_ITEM },
                fields: {
                  value: {
                    refType: flowElementReferenceOrValue,
                  },
                },
              }),
            ),
          },
        },
      })
      accountInstance = createInstanceElement(
        {
          fullName: 'TestAccount',
          Name: 'BestAccount',
        },
        mockTypes.Account,
      )
    })
    describe('when target type does not match referenced type', () => {
      beforeEach(() => {
        flowInstance = createInstanceElement(
          {
            fullName: 'TestFlow',
            assignments: [
              {
                value: {
                  [ELEMENT_REFERENCE]: new ReferenceExpression(accountInstance.elemID, accountInstance),
                },
              },
            ],
          },
          flow,
        )
      })
      it('should return default lookup function', async () => {
        getLookupNameFunc = getLookUpName(fetchProfile)
        const result = await getLookupNameFunc({
          ref: flowInstance.value.assignments[0].value.elementReference,
          field: flowElementReferenceOrValue.fields[ELEMENT_REFERENCE],
          path: flowInstance.elemID.createNestedID('assignments', '0', ELEMENT_REFERENCE),
          element: flowInstance,
        })
        expect(result).toBeUndefined()
      })
    })
    describe('when target type matches referenced type', () => {
      beforeEach(() => {
        flowInstance = createInstanceElement(
          {
            fullName: 'TestFlow',
            assignments: [
              {
                value: {
                  [ELEMENT_REFERENCE]: new ReferenceExpression(
                    mockTypes.Account.fields.Name.elemID,
                    mockTypes.Account.fields.Name,
                  ),
                },
              },
            ],
          },
          flow,
        )
      })
      it('should return the right lookup function', async () => {
        getLookupNameFunc = getLookUpName(fetchProfile)
        const path = flowInstance.elemID.createNestedID('assignments', '0', 'value', ELEMENT_REFERENCE)
        const result = await getLookupNameFunc({
          ref: flowInstance.value.assignments[0].value.elementReference,
          field: flowElementReferenceOrValue.fields[ELEMENT_REFERENCE],
          path,
          element: flowInstance,
        })
        expect(result).toEqual('$Record.Name')
      })
    })
  })

  describe('getLookupNameWithFallbackToElement', () => {
    beforeEach(() => {
      getLookupNameFunc = getLookupNameForDataInstances(defaultFilterContext.fetchProfile)
    })
    describe('when the default strategy resolves to undefined', () => {
      it('should resolve to the referenced instance', async () => {
        const resolvedFirstProduct = await resolveValues(firstProduct, getLookupNameFunc)
        const resolvedSecondProduct = await resolveValues(secondProduct, getLookupNameFunc)
        expect(resolvedFirstProduct.value).toEqual({
          Name: 'Product1',
          [FIELD_NAME]: secondProduct,
        })
        expect(resolvedSecondProduct.value).toEqual({
          Name: 'Product2',
          [FIELD_NAME]: firstProduct,
        })
      })
    })

    describe('when the default strategy resolves to valid value', () => {
      beforeEach(() => {
        firstProduct.value[CUSTOM_OBJECT_ID_FIELD] = FIRST_PRODUCT_ID
        secondProduct.value[CUSTOM_OBJECT_ID_FIELD] = SECOND_PRODUCT_ID
      })
      it('should resolve to value', async () => {
        const resolvedFirstProduct = await resolveValues(firstProduct, getLookupNameFunc)
        const resolvedSecondProduct = await resolveValues(secondProduct, getLookupNameFunc)
        expect(resolvedFirstProduct.value).toEqual({
          [CUSTOM_OBJECT_ID_FIELD]: FIRST_PRODUCT_ID,
          Name: 'Product1',
          [FIELD_NAME]: SECOND_PRODUCT_ID,
        })
        expect(resolvedSecondProduct.value).toEqual({
          [CUSTOM_OBJECT_ID_FIELD]: SECOND_PRODUCT_ID,
          Name: 'Product2',
          [FIELD_NAME]: FIRST_PRODUCT_ID,
        })
      })
    })
  })
  describe('getLookupName', () => {
    beforeEach(() => {
      getLookupNameFunc = getLookUpName(defaultFilterContext.fetchProfile)
    })
    describe('when the default strategy resolves to undefined', () => {
      it('should resolve to undefined', async () => {
        const resolvedFirstProduct = await resolveValues(firstProduct, getLookupNameFunc)
        const resolvedSecondProduct = await resolveValues(secondProduct, getLookupNameFunc)
        expect(resolvedFirstProduct.value).toEqual({
          Name: 'Product1',
          [FIELD_NAME]: undefined,
        })
        expect(resolvedSecondProduct.value).toEqual({
          Name: 'Product2',
          [FIELD_NAME]: undefined,
        })
      })
    })

    describe('when the default strategy resolves to valid value', () => {
      beforeEach(() => {
        firstProduct.value[CUSTOM_OBJECT_ID_FIELD] = FIRST_PRODUCT_ID
        secondProduct.value[CUSTOM_OBJECT_ID_FIELD] = SECOND_PRODUCT_ID
      })
      it('should resolve to value', async () => {
        const resolvedFirstProduct = await resolveValues(firstProduct, getLookupNameFunc)
        const resolvedSecondProduct = await resolveValues(secondProduct, getLookupNameFunc)
        expect(resolvedFirstProduct.value).toEqual({
          [CUSTOM_OBJECT_ID_FIELD]: FIRST_PRODUCT_ID,
          Name: 'Product1',
          [FIELD_NAME]: SECOND_PRODUCT_ID,
        })
        expect(resolvedSecondProduct.value).toEqual({
          [CUSTOM_OBJECT_ID_FIELD]: SECOND_PRODUCT_ID,
          Name: 'Product2',
          [FIELD_NAME]: FIRST_PRODUCT_ID,
        })
      })
    })
  })
})
