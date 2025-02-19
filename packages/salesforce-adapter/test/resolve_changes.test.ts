/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  ElemID,
  Field,
  getChangeData,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { resolveChangeElement } from '@salto-io/adapter-components'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { SALESFORCE } from '../src/constants'
import { createOrderedMapType } from '../src/filters/convert_maps'
import { mockTypes } from './mock_elements'

import { getLookUpName, salesforceAdapterResolveValues } from '../src/transformers/reference_mapping'
import { buildFetchProfile } from '../src/fetch_profile/fetch_profile'

describe('Resolve Salesforce Changes', () => {
  let getLookupNameFunc: GetLookupNameFunc
  beforeEach(() => {
    getLookupNameFunc = getLookUpName(buildFetchProfile({ fetchParams: {} }))
  })
  describe('Elements with OrderedMaps', () => {
    const ORDERED_MAP_FIELD_NAME = 'orderedMapField'
    const EXPECTED_RESOLVED_VALUE = { stringValue: 'Product2' } as const

    let orderedMapType: ObjectType
    let fieldType: ObjectType
    let field: Field
    let orderedMapFieldValue: {
      values: Record<string, { stringValue: ReferenceExpression }>
      order: ReferenceExpression[]
    }
    beforeEach(() => {
      const innerType = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'InnerType'),
        fields: {
          stringValue: { refType: BuiltinTypes.STRING },
        },
      })
      orderedMapType = createOrderedMapType(innerType)
      fieldType = new ObjectType({
        elemID: new ElemID(SALESFORCE, 'FieldType'),
        annotationRefsOrTypes: {
          [ORDERED_MAP_FIELD_NAME]: orderedMapType,
        },
      })
      const valueToResolve = { stringValue: new ReferenceExpression(mockTypes.Product2.elemID, mockTypes.Product2) }
      orderedMapFieldValue = {
        values: {
          Product2: valueToResolve,
        },
        order: [new ReferenceExpression(new ElemID(SALESFORCE, 'RefToValue'), valueToResolve)],
      }
      field = new Field(mockTypes.Account, 'testField', fieldType, {
        [ORDERED_MAP_FIELD_NAME]: orderedMapFieldValue,
      })
    })
    describe('Field Change', () => {
      it('should resolve both the values and order values', async () => {
        const resolvedField = getChangeData(
          await resolveChangeElement(toChange({ after: field }), getLookupNameFunc, salesforceAdapterResolveValues),
        )
        expect(resolvedField.annotations[ORDERED_MAP_FIELD_NAME]).toEqual({
          values: { Product2: EXPECTED_RESOLVED_VALUE },
          order: [EXPECTED_RESOLVED_VALUE],
        })
      })
    })
    describe('ObjectType Change', () => {
      let objectType: ObjectType
      beforeEach(() => {
        objectType = mockTypes.Account.clone()
        objectType.fields.testField = field
      })
      it('should resolve both the values and order values', async () => {
        const resolvedObject = getChangeData(
          await resolveChangeElement(
            toChange({ after: objectType }),
            getLookupNameFunc,
            salesforceAdapterResolveValues,
          ),
        )
        expect(resolvedObject.fields.testField.annotations[ORDERED_MAP_FIELD_NAME]).toEqual({
          values: { Product2: EXPECTED_RESOLVED_VALUE },
          order: [EXPECTED_RESOLVED_VALUE],
        })
      })
    })
    describe('InstanceElement Change', () => {
      let instance: InstanceElement
      beforeEach(() => {
        const instanceType = new ObjectType({
          elemID: new ElemID(SALESFORCE, 'InstanceType'),
          fields: {
            [ORDERED_MAP_FIELD_NAME]: { refType: orderedMapType },
          },
        })
        instance = new InstanceElement('testInstance', instanceType, {
          [ORDERED_MAP_FIELD_NAME]: orderedMapFieldValue,
        })
      })
      it('should resolve both the values and order values', async () => {
        const resolvedInstance = getChangeData(
          await resolveChangeElement(toChange({ after: instance }), getLookupNameFunc, salesforceAdapterResolveValues),
        )
        expect(resolvedInstance.value[ORDERED_MAP_FIELD_NAME]).toEqual({
          values: { Product2: EXPECTED_RESOLVED_VALUE },
          order: [EXPECTED_RESOLVED_VALUE],
        })
      })
    })
  })
})
