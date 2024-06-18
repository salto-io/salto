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
import { toChange, ObjectType, ElemID, InstanceElement, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { uniqueFieldsChangeValidatorCreator } from '../../../src/deployment/change_validators/unique_fields'

describe('unique fields test', () => {
  const relevantObjectType = new ObjectType({ elemID: new ElemID('adapter', 'relevantType') })
  const relevantInstance1 = new InstanceElement('relevantInstance1', relevantObjectType, {
    uniqueField: 'same',
  })
  const relevantInstance2 = new InstanceElement('relevantInstance2', relevantObjectType, {
    uniqueField: 'same',
  })
  const relevantInstance3 = new InstanceElement('relevantInstance3', relevantObjectType, {
    uniqueField: 'other',
  })

  const irrelevantObjectType = new ObjectType({ elemID: new ElemID('adapter', 'irrelevantType') })
  const irrelevantInstance1 = new InstanceElement('irrelevantInstance1', irrelevantObjectType, {
    uniqueField: 'same',
  })
  const irrelevantInstance2 = new InstanceElement('irrelevantInstance2', irrelevantObjectType, {
    uniqueField: 'same',
  })

  const otherRelevantObjectType = new ObjectType({ elemID: new ElemID('adapter', 'otherRelevantType') })
  const otherRelevantInstance1 = new InstanceElement('otherRelevantInstance1', otherRelevantObjectType, {
    otherUniqueField: 'same',
  })
  const otherRelevantInstance2 = new InstanceElement('otherRelevantInstance2', otherRelevantObjectType, {
    otherUniqueField: 'same',
  })

  const uniqueInnerFieldObjectType = new ObjectType({ elemID: new ElemID('adapter', 'uniqueInnerField') })
  const uniqueInnerFieldInstance1 = new InstanceElement('uniqueInnerFieldInstance1', uniqueInnerFieldObjectType, {
    field: {
      uniqueInnerField: 'same',
    },
  })
  const uniqueInnerFieldInstance2 = new InstanceElement('uniqueInnerFieldInstance2', uniqueInnerFieldObjectType, {
    field: {
      uniqueInnerField: 'same',
    },
  })

  let elementSource: ReadOnlyElementsSource
  const changeValidator = uniqueFieldsChangeValidatorCreator({
    [relevantObjectType.elemID.typeName]: 'uniqueField',
    [otherRelevantObjectType.elemID.typeName]: 'otherUniqueField',
    [uniqueInnerFieldObjectType.elemID.typeName]: 'field.uniqueInnerField',
  })

  beforeEach(() => {
    elementSource = buildElementsSourceFromElements([])
  })
  it('should not return error for removal changes', async () => {
    const deletionErrors = await changeValidator(
      [toChange({ before: relevantInstance1 }), toChange({ before: relevantInstance2 })],
      elementSource,
    )
    expect(deletionErrors).toHaveLength(0)
  })
  it('should not return error for unique values', async () => {
    elementSource = buildElementsSourceFromElements([relevantInstance1, relevantInstance3])
    const deletionErrors = await changeValidator([toChange({ after: relevantInstance3 })], elementSource)
    expect(deletionErrors).toHaveLength(0)
  })
  it('should not return error for irrelevant instances', async () => {
    elementSource = buildElementsSourceFromElements([irrelevantInstance1, irrelevantInstance2])
    const deletionErrors = await changeValidator([toChange({ after: irrelevantInstance2 })], elementSource)
    expect(deletionErrors).toHaveLength(0)
  })
  it('should not return error for elements with different types and the same value in the unique field', async () => {
    elementSource = buildElementsSourceFromElements([relevantInstance1, otherRelevantInstance1])
    const deletionErrors = await changeValidator([toChange({ after: otherRelevantInstance1 })], elementSource)
    expect(deletionErrors).toHaveLength(0)
  })
  it('should not return an error if the field is undefined or is not a string', async () => {
    const instance1 = relevantInstance1.clone()
    instance1.value.uniqueField = undefined

    const instance2 = relevantInstance1.clone()
    instance2.value.uniqueField = [1, 2, 3]

    elementSource = buildElementsSourceFromElements([instance1, instance2])
    const deletionErrors = await changeValidator(
      [toChange({ after: instance1 }), toChange({ after: instance2 })],
      elementSource,
    )
    expect(deletionErrors).toHaveLength(0)
  })
  it('should return an error for same unique values', async () => {
    elementSource = buildElementsSourceFromElements([relevantInstance1, relevantInstance2])
    const deletionErrors = await changeValidator([toChange({ after: relevantInstance2 })], elementSource)
    expect(deletionErrors).toHaveLength(1)
    expect(deletionErrors[0]).toEqual({
      elemID: relevantInstance2.elemID,
      severity: 'Error',
      message: `The field 'uniqueField' in type ${relevantInstance2.elemID.typeName} must have a unique value`,
      detailedMessage: `This ${relevantInstance2.elemID.typeName} have the same 'uniqueField' as the instance ${relevantInstance1.elemID.getFullName()}, and can not be deployed.`,
    })
  })
  it('should return an error for multiple changes with the same field', async () => {
    const instance1After = relevantInstance1.clone()
    instance1After.value.uniqueField = 'new'

    const instance2After = relevantInstance2.clone()
    instance2After.value.uniqueField = 'new'

    elementSource = buildElementsSourceFromElements([instance1After, instance2After])
    const deletionErrors = await changeValidator(
      [
        toChange({ before: relevantInstance1, after: instance1After }),
        toChange({ before: relevantInstance2, after: instance2After }),
      ],
      elementSource,
    )
    expect(deletionErrors).toHaveLength(2)
    expect(deletionErrors[0]).toEqual({
      elemID: instance1After.elemID,
      severity: 'Error',
      message: `The field 'uniqueField' in type ${instance1After.elemID.typeName} must have a unique value`,
      detailedMessage: `This ${instance1After.elemID.typeName} have the same 'uniqueField' as the instance ${instance2After.elemID.getFullName()}, and can not be deployed.`,
    })
    expect(deletionErrors[1]).toEqual({
      elemID: instance2After.elemID,
      severity: 'Error',
      message: `The field 'uniqueField' in type ${instance2After.elemID.typeName} must have a unique value`,
      detailedMessage: `This ${instance2After.elemID.typeName} have the same 'uniqueField' as the instance ${instance1After.elemID.getFullName()}, and can not be deployed.`,
    })
  })
  it('should return errors for multiple relevant types and reference them correctly', async () => {
    elementSource = buildElementsSourceFromElements([
      relevantInstance1,
      relevantInstance2,
      otherRelevantInstance1,
      otherRelevantInstance2,
    ])
    const deletionErrors = await changeValidator(
      [toChange({ after: relevantInstance2 }), toChange({ after: otherRelevantInstance2 })],
      elementSource,
    )
    expect(deletionErrors).toHaveLength(2)
    expect(deletionErrors).toEqual([
      {
        elemID: relevantInstance2.elemID,
        severity: 'Error',
        message: `The field 'uniqueField' in type ${relevantInstance2.elemID.typeName} must have a unique value`,
        detailedMessage: `This ${relevantInstance2.elemID.typeName} have the same 'uniqueField' as the instance ${relevantInstance1.elemID.getFullName()}, and can not be deployed.`,
      },
      {
        elemID: otherRelevantInstance2.elemID,
        severity: 'Error',
        message: `The field 'otherUniqueField' in type ${otherRelevantInstance2.elemID.typeName} must have a unique value`,
        detailedMessage: `This ${otherRelevantInstance2.elemID.typeName} have the same 'otherUniqueField' as the instance ${otherRelevantInstance1.elemID.getFullName()}, and can not be deployed.`,
      },
    ])
  })
  it('should return an error for the same unique inner field value', async () => {
    elementSource = buildElementsSourceFromElements([uniqueInnerFieldInstance1, uniqueInnerFieldInstance2])
    const deletionErrors = await changeValidator([toChange({ after: uniqueInnerFieldInstance2 })], elementSource)
    expect(deletionErrors).toHaveLength(1)
    expect(deletionErrors[0]).toEqual({
      elemID: uniqueInnerFieldInstance2.elemID,
      severity: 'Error',
      message: `The field 'field.uniqueInnerField' in type ${uniqueInnerFieldInstance2.elemID.typeName} must have a unique value`,
      detailedMessage: `This ${uniqueInnerFieldInstance2.elemID.typeName} have the same 'field.uniqueInnerField' as the instance ${uniqueInnerFieldInstance1.elemID.getFullName()}, and can not be deployed.`,
    })
  })
})
