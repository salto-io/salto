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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { uniqueFieldsChangeValidatorCreator } from '../../../src/deployment/change_validators/unique_fields'

describe('unique fields', () => {
  let relevantInstance1: InstanceElement
  let relevantInstance2: InstanceElement
  let relevantInstance3: InstanceElement

  let irrelevantInstance1: InstanceElement
  let irrelevantInstance2: InstanceElement

  let otherRelevantInstance1: InstanceElement
  let otherRelevantInstance2: InstanceElement

  let uniqueInnerFieldInstance1: InstanceElement
  let uniqueInnerFieldInstance2: InstanceElement

  const relevantObjectType = new ObjectType({ elemID: new ElemID('adapter', 'relevantType') })
  const irrelevantObjectType = new ObjectType({ elemID: new ElemID('adapter', 'irrelevantType') })
  const otherRelevantObjectType = new ObjectType({ elemID: new ElemID('adapter', 'otherRelevantType') })
  const uniqueInnerFieldObjectType = new ObjectType({ elemID: new ElemID('adapter', 'uniqueInnerField') })

  const changeValidator = uniqueFieldsChangeValidatorCreator({
    [relevantObjectType.elemID.typeName]: 'uniqueField',
    [otherRelevantObjectType.elemID.typeName]: 'otherUniqueField',
    [uniqueInnerFieldObjectType.elemID.typeName]: 'field.uniqueInnerField',
  })

  beforeEach(() => {
    relevantInstance1 = new InstanceElement('relevantInstance1', relevantObjectType, {
      uniqueField: 'same',
    })
    relevantInstance2 = new InstanceElement('relevantInstance2', relevantObjectType, {
      uniqueField: 'same',
    })
    relevantInstance3 = new InstanceElement('relevantInstance3', relevantObjectType, {
      uniqueField: 'other',
    })

    irrelevantInstance1 = new InstanceElement('irrelevantInstance1', irrelevantObjectType, {
      uniqueField: 'same',
    })
    irrelevantInstance2 = new InstanceElement('irrelevantInstance2', irrelevantObjectType, {
      uniqueField: 'same',
    })

    otherRelevantInstance1 = new InstanceElement('otherRelevantInstance1', otherRelevantObjectType, {
      otherUniqueField: 'same',
    })
    otherRelevantInstance2 = new InstanceElement('otherRelevantInstance2', otherRelevantObjectType, {
      otherUniqueField: 'same',
    })

    uniqueInnerFieldInstance1 = new InstanceElement('uniqueInnerFieldInstance1', uniqueInnerFieldObjectType, {
      field: {
        uniqueInnerField: 'same',
      },
    })
    uniqueInnerFieldInstance2 = new InstanceElement('uniqueInnerFieldInstance2', uniqueInnerFieldObjectType, {
      field: {
        uniqueInnerField: 'same',
      },
    })
  })

  it('should not return error for removal changes', async () => {
    const elementSource = buildElementsSourceFromElements([])
    const changeErrors = await changeValidator(
      [toChange({ before: relevantInstance1 }), toChange({ before: relevantInstance2 })],
      elementSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error for unique values', async () => {
    const elementSource = buildElementsSourceFromElements([relevantInstance1, relevantInstance3])
    const changeErrors = await changeValidator([toChange({ after: relevantInstance3 })], elementSource)
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error for irrelevant instances', async () => {
    const elementSource = buildElementsSourceFromElements([irrelevantInstance1, irrelevantInstance2])
    const changeErrors = await changeValidator([toChange({ after: irrelevantInstance2 })], elementSource)
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error for elements with different types same value in the unique field', async () => {
    const elementSource = buildElementsSourceFromElements([
      relevantInstance1,
      irrelevantInstance1,
      otherRelevantInstance1,
    ])
    const changeErrors = await changeValidator(
      [
        toChange({ after: relevantInstance1 }),
        toChange({ after: irrelevantInstance1 }),
        toChange({ after: otherRelevantInstance1 }),
      ],
      elementSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return an error if the field is undefined or is not a string', async () => {
    relevantInstance1.value.uniqueField = undefined
    relevantInstance2.value.uniqueField = [1, 2, 3]

    const elementSource = buildElementsSourceFromElements([relevantInstance1, relevantInstance2])
    const changeErrors = await changeValidator(
      [toChange({ after: relevantInstance1 }), toChange({ after: relevantInstance2 })],
      elementSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should return an error for same unique values', async () => {
    const elementSource = buildElementsSourceFromElements([relevantInstance1, relevantInstance2])
    const changeErrors = await changeValidator([toChange({ after: relevantInstance2 })], elementSource)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: relevantInstance2.elemID,
      severity: 'Error',
      message: "The field 'uniqueField' in type relevantType must have a unique value",
      detailedMessage:
        "This relevantType have the same 'uniqueField' as the instance adapter.relevantType.instance.relevantInstance1, and can not be deployed.",
    })
  })
  it('should return an error for multiple changes with the same field', async () => {
    const relevantInstance1After = relevantInstance1.clone()
    relevantInstance1After.value.uniqueField = 'new'

    const relevantInstance2After = relevantInstance2.clone()
    relevantInstance2After.value.uniqueField = 'new'

    const elementSource = buildElementsSourceFromElements([relevantInstance1After, relevantInstance2After])
    const changeErrors = await changeValidator(
      [
        toChange({ before: relevantInstance1, after: relevantInstance1After }),
        toChange({ before: relevantInstance2, after: relevantInstance2After }),
      ],
      elementSource,
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors[0]).toEqual({
      elemID: relevantInstance1After.elemID,
      severity: 'Error',
      message: "The field 'uniqueField' in type relevantType must have a unique value",
      detailedMessage:
        "This relevantType have the same 'uniqueField' as the instance adapter.relevantType.instance.relevantInstance2, and can not be deployed.",
    })
    expect(changeErrors[1]).toEqual({
      elemID: relevantInstance2After.elemID,
      severity: 'Error',
      message: "The field 'uniqueField' in type relevantType must have a unique value",
      detailedMessage:
        "This relevantType have the same 'uniqueField' as the instance adapter.relevantType.instance.relevantInstance1, and can not be deployed.",
    })
  })
  it('should return errors for multiple relevant types and reference them correctly', async () => {
    const elementSource = buildElementsSourceFromElements([
      relevantInstance1,
      relevantInstance2,
      otherRelevantInstance1,
      otherRelevantInstance2,
    ])
    const changeErrors = await changeValidator(
      [toChange({ after: relevantInstance2 }), toChange({ after: otherRelevantInstance2 })],
      elementSource,
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors[0]).toEqual({
      elemID: relevantInstance2.elemID,
      severity: 'Error',
      message: "The field 'uniqueField' in type relevantType must have a unique value",
      detailedMessage:
        "This relevantType have the same 'uniqueField' as the instance adapter.relevantType.instance.relevantInstance1, and can not be deployed.",
    })
    expect(changeErrors[1]).toEqual({
      elemID: otherRelevantInstance2.elemID,
      severity: 'Error',
      message: "The field 'otherUniqueField' in type otherRelevantType must have a unique value",
      detailedMessage:
        "This otherRelevantType have the same 'otherUniqueField' as the instance adapter.otherRelevantType.instance.otherRelevantInstance1, and can not be deployed.",
    })
  })
  it('should return an error for the same unique inner field value', async () => {
    const elementSource = buildElementsSourceFromElements([uniqueInnerFieldInstance1, uniqueInnerFieldInstance2])
    const changeErrors = await changeValidator([toChange({ after: uniqueInnerFieldInstance2 })], elementSource)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: uniqueInnerFieldInstance2.elemID,
      severity: 'Error',
      message: "The field 'field.uniqueInnerField' in type uniqueInnerField must have a unique value",
      detailedMessage:
        "This uniqueInnerField have the same 'field.uniqueInnerField' as the instance adapter.uniqueInnerField.instance.uniqueInnerFieldInstance1, and can not be deployed.",
    })
  })
})
