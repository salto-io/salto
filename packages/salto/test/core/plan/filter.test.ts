import _ from 'lodash'
import { AdditionDiff, ModificationDiff } from '@salto/dag'
import {
  ChangeError, isObjectType, Change, getChangeElement, ChangeValidator, ObjectType, ElemID,
  InstanceElement, Field, BuiltinTypes, Element,
} from 'adapter-api'
import * as mock from '../../common/elements'
import { getFirstPlanItem } from '../../common/plan'
import { getPlan } from '../../../src/core/plan'


describe('filterInvalidChanges', () => {
  const allElements = mock.getAllElements()

  const generateChangeErrorForInvalidElements = async (element: Element):
    Promise<ChangeError[]> => {
    if (element.elemID.name.includes('invalid')) {
      return [{
        elemID: element.elemID,
        severity: 'Error',
        message: 'message',
        detailedMessage: 'detailedMessage',
      }] as ChangeError[]
    }
    if (isObjectType(element)) {
      return Object.values(element.fields)
        .filter(field => field.elemID.name.includes('invalid'))
        .map(field => ({
          elemID: field.elemID,
          severity: 'Error',
          message: 'message',
          detailedMessage: 'detailedMessage',
        }))
    }
    return []
  }

  const mockOnAdd = generateChangeErrorForInvalidElements
  const mockOnRemove = generateChangeErrorForInvalidElements
  const mockOnUpdate = async (changes: ReadonlyArray<Change>): Promise<ChangeError[]> =>
    _.flatten(await Promise.all(
      _(changes)
        .map(change => generateChangeErrorForInvalidElements(getChangeElement(change)))
        .value()
    ))

  const mockChangeValidator: ChangeValidator = {
    onAdd: mockOnAdd,
    onUpdate: mockOnUpdate,
    onRemove: mockOnRemove,
  }

  it('should have no change errors when having no diffs', async () => {
    const planResult = await getPlan(allElements, allElements, { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(0)
    expect(planResult.size).toBe(0)
  })

  it('should have no change errors when having only valid changes', async () => {
    const newValidObj = new ObjectType({ elemID: new ElemID('salto', 'new_valid_obj') })
    const newValidInst = new InstanceElement('new_valid_inst', newValidObj, {})
    const planResult = await getPlan(allElements, [...allElements, newValidObj, newValidInst],
      { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(0)
    expect(planResult.size).toBe(2)
  })

  it('should have onAdd change errors and omit invalid object & instance addition', async () => {
    const newInvalidObj = new ObjectType({ elemID: new ElemID('salto', 'new_invalid_obj') })
    newInvalidObj.fields.valid = new Field(newInvalidObj.elemID, 'valid', BuiltinTypes.STRING)
    newInvalidObj.fields.invalid = new Field(newInvalidObj.elemID, 'invalid', BuiltinTypes.STRING)
    newInvalidObj.annotations.value = 'value'
    const newInvalidInst = new InstanceElement('new_invalid_inst', newInvalidObj, {})
    const planResult = await getPlan(allElements, [...allElements, newInvalidObj, newInvalidInst],
      { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(2)
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(newInvalidObj.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(newInvalidInst.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.every(v => v.severity === 'Error')).toBeTruthy()
    expect(planResult.size).toBe(0)
  })

  it('should have onAdd change errors and omit invalid object & insatance additionaaaaa', async () => {
    const newValidObj = new ObjectType({ elemID: new ElemID('salto', 'new_valid_obj') })
    newValidObj.fields.valid = new Field(newValidObj.elemID, 'valid', BuiltinTypes.STRING)
    newValidObj.fields.invalid = new Field(newValidObj.elemID, 'invalid', BuiltinTypes.STRING)
    newValidObj.annotations.value = 'value'
    const planResult = await getPlan(allElements, [...allElements, newValidObj],
      { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(1)
    expect(planResult.changeErrors[0].elemID.isEqual(newValidObj.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.changeErrors[0].severity === 'Error').toBeTruthy()
    expect(planResult.size).toBe(1)
    const planItem = getFirstPlanItem(planResult)
    expect(planItem.items.size).toBe(1)
    const parent = planItem.parent() as AdditionDiff<ObjectType>
    const parentFields = Object.keys(parent.data.after.fields)
    expect(parentFields).toContain('valid')
    expect(parentFields).not.toContain('invalid')
  })

  it('should have onUpdate change errors when all changes are invalid', async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2] as ObjectType
    saltoOffice.fields.invalid = new Field(saltoOffice.elemID, 'invalid', BuiltinTypes.STRING)
    const planResult = await getPlan(allElements, afterElements, { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(1)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(saltoOffice.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.size).toBe(0)
  })

  it('should have onUpdate change errors when only some field addition are invalid', async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2] as ObjectType
    saltoOffice.fields.invalid = new Field(saltoOffice.elemID, 'invalid', BuiltinTypes.STRING)
    saltoOffice.fields.valid = new Field(saltoOffice.elemID, 'valid', BuiltinTypes.STRING)
    const planResult = await getPlan(allElements, afterElements, { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(1)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(saltoOffice.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.size).toBe(1)
    const planItem = getFirstPlanItem(planResult)
    expect(planItem.items.size).toBe(1)
    const parent = planItem.parent() as ModificationDiff<ObjectType>
    const parentFields = Object.keys(parent.data.after.fields)
    expect(parentFields).toContain('valid')
    expect(parentFields).not.toContain('invalid')
  })

  it('should have onUpdate change error when modifying invalid object annotations and omit the creation of valid field', async () => {
    const invalidObjElemId = new ElemID('salto', 'invalid')
    const beforeInvalidObj = new ObjectType({ elemID: invalidObjElemId })
    const afterInvalidObj = beforeInvalidObj.clone()
    afterInvalidObj.annotations.new = 'value'
    afterInvalidObj.annotationTypes.new = BuiltinTypes.STRING
    afterInvalidObj.fields.valid = new Field(invalidObjElemId, 'valid', BuiltinTypes.STRING)
    const planResult = await getPlan([...allElements, beforeInvalidObj],
      [...allElements, afterInvalidObj], { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(1)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(afterInvalidObj.elemID)).toBeTruthy()
    expect(planResult.size).toBe(0)
  })

  it('should have onUpdate change errors when only some field removals are invalid', async () => {
    const beforeElements = mock.getAllElements()
    const saltoOffice = beforeElements[2] as ObjectType
    saltoOffice.fields.invalid = new Field(saltoOffice.elemID, 'invalid', BuiltinTypes.STRING)
    saltoOffice.fields.valid = new Field(saltoOffice.elemID, 'valid', BuiltinTypes.STRING)
    const planResult = await getPlan(beforeElements, allElements, { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(1)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(saltoOffice.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.size).toBe(1)
    const planItem = getFirstPlanItem(planResult)
    expect(planItem.items.size).toBe(1)
    const parent = planItem.parent() as ModificationDiff<ObjectType>
    const afterFields = Object.keys(parent.data.after.fields)
    expect(afterFields).toContain('invalid')
    expect(afterFields).not.toContain('valid')
  })

  it('should have onUpdate change errors when having invalid field modification', async () => {
    const beforeElements = mock.getAllElements()
    const beforeSaltoOffice = beforeElements[2] as ObjectType
    beforeSaltoOffice.fields.invalid = new Field(beforeSaltoOffice.elemID, 'invalid',
      BuiltinTypes.STRING)
    const afterElements = mock.getAllElements()
    const afterSaltoOffice = afterElements[2] as ObjectType
    afterSaltoOffice.fields.invalid = new Field(afterSaltoOffice.elemID, 'invalid',
      BuiltinTypes.STRING, { label: 'dummy annotation' })
    const planResult = await getPlan(beforeElements, afterElements,
      { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(1)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(afterSaltoOffice.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.size).toBe(0)
  })

  it('should have onRemove change errors', async () => {
    const beforeInvalidObj = new ObjectType({ elemID: new ElemID('salto', 'before_invalid_obj') })
    beforeInvalidObj.fields.invalid = new Field(beforeInvalidObj.elemID, 'invalid',
      BuiltinTypes.STRING)
    const beforeInvalidInst = new InstanceElement('before_invalid_inst', beforeInvalidObj, {})
    const planResult = await getPlan([...allElements, beforeInvalidObj, beforeInvalidInst],
      allElements, { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(2)
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(beforeInvalidObj.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(beforeInvalidInst.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.every(v => v.severity === 'Error')).toBeTruthy()
    expect(planResult.size).toBe(0)
  })

  it('should not remove object if having invalid field errors', async () => {
    const beforeValidObj = new ObjectType({ elemID: new ElemID('salto', 'before_valid_obj') })
    beforeValidObj.fields.invalid = new Field(beforeValidObj.elemID, 'invalid',
      BuiltinTypes.STRING)
    const planResult = await getPlan([...allElements, beforeValidObj],
      allElements, { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(1)
    expect(planResult.changeErrors[0].elemID.isEqual(beforeValidObj.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.changeErrors[0].severity === 'Error').toBeTruthy()
    expect(planResult.size).toBe(0)
  })
})
