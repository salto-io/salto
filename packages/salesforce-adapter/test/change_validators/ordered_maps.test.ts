/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  Element,
  ElemID,
  InstanceElement, ListType,
  ObjectType,
  ReferenceExpression, toChange,
  Value,
} from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/ordered_maps'
import { METADATA_TYPE, SALESFORCE } from '../../src/constants'
import { GLOBAL_VALUE_SET } from '../../src/filters/global_value_sets'
import { Types } from '../../src/transformers/transformer'

describe('OrderedMap Change Validator', () => {
  const gvsType = new ObjectType({
    elemID: new ElemID(SALESFORCE, GLOBAL_VALUE_SET),
    annotations: {[METADATA_TYPE]: GLOBAL_VALUE_SET},
  })
  const gvs = new InstanceElement('MyGVS', gvsType, {
    customValue: {
      values: {
        val1: 'value1',
        val2: 'value2',
      },
    }
  })
  /*
  gvs.value.order = [
    new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val1')),
    new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val2')),
  ]

   */

  it('should return an error when the order field is missing', async () => {
    const errors = await changeValidator([
      toChange({ after: gvs })
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      elemID: gvs.elemID,
      severity: 'Error',
      message: 'Missing field in ordered map',
      detailedMessage: 'Missing order or values fields in field customValue',
    })
  })
  it('should return an error when a field ref is missing', async () => {
    gvs.value.customValue.order = [
      new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val1')),
    ]
    const errors = await changeValidator([
      toChange({ after: gvs })
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      elemID: gvs.elemID,
      severity: 'Error',
      message: 'Missing reference in ordered map',
      detailedMessage: 'Missing reference in field customValue.order: val2',
    })
  })
})