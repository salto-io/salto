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
import { InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { resolveValues } from '@salto-io/adapter-components'

import { mockTypes } from '../mock_elements'
import {
  getLookUpName,
  getLookupNameForDataInstances,
} from '../../src/transformers/reference_mapping'
import { CUSTOM_OBJECT_ID_FIELD } from '../../src/constants'

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
    firstProduct.value[FIELD_NAME] = new ReferenceExpression(
      secondProduct.elemID,
      secondProduct,
    )
    secondProduct.value[FIELD_NAME] = new ReferenceExpression(
      firstProduct.elemID,
      firstProduct,
    )
  })

  describe('getLookupNameWithFallbackToElement', () => {
    beforeEach(() => {
      getLookupNameFunc = getLookupNameForDataInstances
    })
    describe('when the default strategy resolves to undefined', () => {
      it('should resolve to the referenced instance', async () => {
        const resolvedFirstProduct = await resolveValues(
          firstProduct,
          getLookupNameFunc,
        )
        const resolvedSecondProduct = await resolveValues(
          secondProduct,
          getLookupNameFunc,
        )
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
        const resolvedFirstProduct = await resolveValues(
          firstProduct,
          getLookupNameFunc,
        )
        const resolvedSecondProduct = await resolveValues(
          secondProduct,
          getLookupNameFunc,
        )
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
      getLookupNameFunc = getLookUpName
    })
    describe('when the default strategy resolves to undefined', () => {
      it('should resolve to undefined', async () => {
        const resolvedFirstProduct = await resolveValues(
          firstProduct,
          getLookupNameFunc,
        )
        const resolvedSecondProduct = await resolveValues(
          secondProduct,
          getLookupNameFunc,
        )
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
        const resolvedFirstProduct = await resolveValues(
          firstProduct,
          getLookupNameFunc,
        )
        const resolvedSecondProduct = await resolveValues(
          secondProduct,
          getLookupNameFunc,
        )
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
