/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  toChange,
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { SCOPE, uniqueFieldsChangeValidatorCreator } from '../../../src/deployment/change_validators/unique_fields'

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

  let parentScopeInstance1: InstanceElement
  let parentScopeInstance2: InstanceElement

  const relevantObjectType = new ObjectType({ elemID: new ElemID('adapter', 'relevantType') })
  const irrelevantObjectType = new ObjectType({ elemID: new ElemID('adapter', 'irrelevantType') })
  const otherRelevantObjectType = new ObjectType({ elemID: new ElemID('adapter', 'otherRelevantType') })
  const uniqueInnerFieldObjectType = new ObjectType({ elemID: new ElemID('adapter', 'uniqueInnerField') })
  const multiFieldsObjectType = new ObjectType({ elemID: new ElemID('adapter', 'multiFieldsType') })
  const parentScopeObjectType = new ObjectType({ elemID: new ElemID('adapter', 'parentScopeType') })

  const changeValidator = uniqueFieldsChangeValidatorCreator({
    [relevantObjectType.elemID.typeName]: { scope: SCOPE.global, uniqueFields: ['uniqueField'] },
    [otherRelevantObjectType.elemID.typeName]: { scope: SCOPE.global, uniqueFields: ['otherUniqueField'] },
    [uniqueInnerFieldObjectType.elemID.typeName]: { scope: SCOPE.global, uniqueFields: ['field.uniqueInnerField'] },
    [multiFieldsObjectType.elemID.typeName]: { scope: SCOPE.global, uniqueFields: ['uniqueField1', 'uniqueField2'] },
    [parentScopeObjectType.elemID.typeName]: { scope: SCOPE.parent, uniqueFields: ['uniqueField'] },
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
    parentScopeInstance1 = new InstanceElement('parentScopeInstance1', parentScopeObjectType, {
      uniqueField: 'same',
    })
    parentScopeInstance2 = new InstanceElement('parentScopeInstance2', parentScopeObjectType, {
      uniqueField: 'same',
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
        "This instance cannot be deployed due to non-unique values within the entire environment in the following fields: 'uniqueField'.",
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
        "This instance cannot be deployed due to non-unique values within the entire environment in the following fields: 'uniqueField'.",
    })
    expect(changeErrors[1]).toEqual({
      elemID: relevantInstance2After.elemID,
      severity: 'Error',
      message: "The field 'uniqueField' in type relevantType must have a unique value",
      detailedMessage:
        "This instance cannot be deployed due to non-unique values within the entire environment in the following fields: 'uniqueField'.",
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
        "This instance cannot be deployed due to non-unique values within the entire environment in the following fields: 'uniqueField'.",
    })
    expect(changeErrors[1]).toEqual({
      elemID: otherRelevantInstance2.elemID,
      severity: 'Error',
      message: "The field 'otherUniqueField' in type otherRelevantType must have a unique value",
      detailedMessage:
        "This instance cannot be deployed due to non-unique values within the entire environment in the following fields: 'otherUniqueField'.",
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
        "This instance cannot be deployed due to non-unique values within the entire environment in the following fields: 'field.uniqueInnerField'.",
    })
  })
  it('should return an error for the same unique values in multiple fields', async () => {
    const multiFieldsInstance1 = new InstanceElement('multiFieldsInstance1', multiFieldsObjectType, {
      uniqueField1: 'same',
      uniqueField2: 'same',
    })
    const multiFieldsInstance2 = new InstanceElement('multiFieldsInstance2', multiFieldsObjectType, {
      uniqueField1: 'same',
      uniqueField2: 'same',
    })

    const elementSource = buildElementsSourceFromElements([multiFieldsInstance1, multiFieldsInstance2])
    const changeErrors = await changeValidator([toChange({ after: multiFieldsInstance2 })], elementSource)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: multiFieldsInstance2.elemID,
      severity: 'Error',
      message: "The fields 'uniqueField1', 'uniqueField2' in type multiFieldsType must have unique values",
      detailedMessage:
        "This instance cannot be deployed due to non-unique values within the entire environment in the following fields: 'uniqueField1', 'uniqueField2'.",
    })
  })
  it('should return an error for multiple fields type with only one non unique value', async () => {
    const multiFieldsInstance1 = new InstanceElement('multiFieldsInstance1', multiFieldsObjectType, {
      uniqueField1: 'same',
      uniqueField2: 'same',
    })
    const multiFieldsInstance2 = new InstanceElement('multiFieldsInstance2', multiFieldsObjectType, {
      uniqueField1: 'same',
      uniqueField2: 'other',
    })

    const elementSource = buildElementsSourceFromElements([multiFieldsInstance1, multiFieldsInstance2])
    const changeErrors = await changeValidator([toChange({ after: multiFieldsInstance2 })], elementSource)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: multiFieldsInstance2.elemID,
      severity: 'Error',
      message: "The fields 'uniqueField1', 'uniqueField2' in type multiFieldsType must have unique values",
      detailedMessage:
        "This instance cannot be deployed due to non-unique values within the entire environment in the following fields: 'uniqueField1'.",
    })
  })
  it('should not return an error when the elementsSource is undefined', async () => {
    const changeErrors = await changeValidator(
      [toChange({ after: relevantInstance1 }), toChange({ after: relevantInstance2 })],
      undefined,
    )
    expect(changeErrors).toHaveLength(0)
  })
  describe('parent scope', () => {
    const parentInstance1 = new InstanceElement('parentInstance1', irrelevantObjectType, {})
    const parentInstance2 = new InstanceElement('parentInstance2', irrelevantObjectType, {})
    it('should return an error for the same unique values in the same parent', async () => {
      parentScopeInstance1.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(parentInstance1.elemID)
      parentScopeInstance2.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(parentInstance1.elemID)
      const elementSource = buildElementsSourceFromElements([parentScopeInstance1, parentScopeInstance2])
      const changeErrors = await changeValidator([toChange({ after: parentScopeInstance1 })], elementSource)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0]).toEqual({
        elemID: parentScopeInstance1.elemID,
        severity: 'Error',
        message: "The field 'uniqueField' in type parentScopeType must have a unique value",
        detailedMessage:
          "This instance cannot be deployed due to non-unique values within the children of the same parent in the following fields: 'uniqueField'.",
      })
    })
    it('should not return an error for the same unique values in different parents', async () => {
      parentScopeInstance1.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(parentInstance1.elemID)
      parentScopeInstance2.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(parentInstance2.elemID)
      const elementSource = buildElementsSourceFromElements([parentScopeInstance1, parentScopeInstance2])
      const changeErrors = await changeValidator(
        [toChange({ before: parentScopeInstance1, after: parentScopeInstance1 })],
        elementSource,
      )
      expect(changeErrors).toHaveLength(0)
    })
    it('should not return an error for different unique values in the same parent', async () => {
      parentScopeInstance1.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(parentInstance1.elemID)
      parentScopeInstance2.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(parentInstance1.elemID)
      parentScopeInstance2.value.uniqueField = 'other'
      const elementSource = buildElementsSourceFromElements([parentScopeInstance1, parentScopeInstance2])
      const changeErrors = await changeValidator(
        [toChange({ before: parentScopeInstance1, after: parentScopeInstance2 })],
        elementSource,
      )
      expect(changeErrors).toHaveLength(0)
    })
    it('should throw an error when the parent is not a reference expression', async () => {
      parentScopeInstance1.annotations[CORE_ANNOTATIONS.PARENT] = 'some string'
      const elementSource = buildElementsSourceFromElements([parentScopeInstance1])
      await expect(changeValidator([toChange({ after: parentScopeInstance1 })], elementSource)).rejects.toThrow(
        'Expected adapter.parentScopeType.instance.parentScopeInstance1 parent to be a reference expression',
      )
    })
    it('should throw an error when there is no parent', async () => {
      const elementSource = buildElementsSourceFromElements([parentScopeInstance1])
      await expect(changeValidator([toChange({ after: parentScopeInstance1 })], elementSource)).rejects.toThrow(
        'Expected adapter.parentScopeType.instance.parentScopeInstance1 to have exactly one parent, found 0',
      )
    })
    it('should not return an error if the field is undefined or is not a string', async () => {
      parentScopeInstance1.value.uniqueField = undefined
      parentScopeInstance2.value.uniqueField = [1, 2, 3]

      const elementSource = buildElementsSourceFromElements([parentScopeInstance1, parentScopeInstance2])
      const changeErrors = await changeValidator(
        [toChange({ after: relevantInstance1 }), toChange({ after: relevantInstance2 })],
        elementSource,
      )
      expect(changeErrors).toHaveLength(0)
    })
  })
})
