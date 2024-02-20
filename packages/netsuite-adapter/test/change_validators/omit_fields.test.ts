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

import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { NETSUITE } from '../../src/constants'
import omitFieldsValidation from '../../src/change_validators/omit_fields'
import { fullFetchConfig } from '../../src/config/config_creator'

describe('omit fields change validator test', () => {
  let type: ObjectType
  let innerType: ObjectType
  let instance: InstanceElement
  let after: InstanceElement
  beforeEach(async () => {
    innerType = new ObjectType({ elemID: new ElemID(NETSUITE, 'innerType') })
    type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'inventoryItem'),
      fields: {
        currency: { refType: BuiltinTypes.STRING },
        field2: { refType: BuiltinTypes.BOOLEAN },
        innerField: { refType: innerType },
      },
    })
    instance = new InstanceElement('test', type, {
      currency: 'Shekel',
      field2: true,
      innerField: { inner1: 'inner1', inner2: 'inner2' },
    })
    after = instance.clone()
  })
  it('should have warning on elements that contain fields that will be omitted', async () => {
    const changeErrors = await omitFieldsValidation(
      [toChange({ after: instance })],
      undefined,
      buildElementsSourceFromElements([instance, type, innerType]),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: instance.elemID,
      severity: 'Warning',
      message: "This element will be deployed without the following fields: 'currency'",
      detailedMessage:
        "This element will be deployed without the following fields: 'currency', as NetSuite does not support deploying them.",
    })
  })

  it('should have warning on modification change the contains a field that will be omitted', async () => {
    after.value.currency = 'Dong'
    after.value.field2 = false
    const changeErrors = await omitFieldsValidation(
      [toChange({ before: instance, after })],
      undefined,
      buildElementsSourceFromElements([instance, type, innerType]),
    )
    expect(changeErrors[0]).toEqual({
      elemID: instance.elemID,
      severity: 'Warning',
      message: "This element will be deployed without the following fields: 'currency'",
      detailedMessage:
        "This element will be deployed without the following fields: 'currency', as NetSuite does not support deploying them.",
    })
  })

  it('should have error when all changed fields will be ommited', async () => {
    after.value.currency = 'Dong'
    after.value.field2 = false
    const changeErrors = await omitFieldsValidation(
      [toChange({ before: instance, after })],
      undefined,
      buildElementsSourceFromElements([instance, type, innerType]),
      {
        fetch: fullFetchConfig(),
        deploy: { fieldsToOmit: [{ type: 'inventoryItem', fields: ['field.*'] }] },
      },
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'This element contains an undeployable change',
      detailedMessage:
        "This element will be removed from deployment because it only contains changes to the undeployable fields: 'currency', 'field2'.",
    })
  })

  it('should have warning when omitting an inner field', async () => {
    after.value.innerField.inner1 = 'afterValue'
    const changeErrors = await omitFieldsValidation(
      [toChange({ before: instance, after })],
      undefined,
      buildElementsSourceFromElements([instance, type, innerType]),
      {
        fetch: fullFetchConfig(),
        deploy: { fieldsToOmit: [{ type: 'inventoryItem', subtype: 'inner.*', fields: ['.*2'] }] },
      },
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: instance.elemID,
      severity: 'Warning',
      message: "This element will be deployed without the following fields: 'currency', 'innerField.inner2'",
      detailedMessage:
        "This element will be deployed without the following fields: 'currency', 'innerField.inner2', as NetSuite does not support deploying them.",
    })
  })

  it('should not have change error if no field is about to be ommited', async () => {
    instance.value = _.omit(instance.value, ['currency'])
    const changeErrors = await omitFieldsValidation(
      [toChange({ after: instance })],
      undefined,
      buildElementsSourceFromElements([instance, type, innerType]),
    )
    expect(changeErrors).toHaveLength(0)
  })
})
