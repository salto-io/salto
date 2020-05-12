/*
*                      Copyright 2020 Salto Labs Ltd.
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
import _ from 'lodash'
import { AdditionDiff, ModificationDiff } from '@salto-io/dag'
import {
  ChangeError, isObjectType, Change, getChangeElement, ChangeValidator, ObjectType, ElemID,
  InstanceElement, Field, BuiltinTypes, Element,
} from '@salto-io/adapter-api'
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
    const newInvalidObj = new ObjectType({
      elemID: new ElemID('salto', 'new_invalid_obj'),
      fields: [
        { name: 'valid', type: BuiltinTypes.STRING },
        { name: 'invalid', type: BuiltinTypes.STRING },
      ],
      annotations: { value: 'value' },
    })
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
    const newValidObj = new ObjectType({
      elemID: new ElemID('salto', 'new_valid_obj'),
      fields: [
        { name: 'valid', type: BuiltinTypes.STRING },
        { name: 'invalid', type: BuiltinTypes.STRING },
      ],
      annotations: { value: 'value' },
    })
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
    saltoOffice.fields.invalid = new Field(saltoOffice, 'invalid', BuiltinTypes.STRING)
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
    saltoOffice.fields.invalid = new Field(saltoOffice, 'invalid', BuiltinTypes.STRING)
    saltoOffice.fields.valid = new Field(saltoOffice, 'valid', BuiltinTypes.STRING)
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

  it('should have onUpdate change error when modifying invalid object annotations and keep the creation of valid field', async () => {
    const invalidObjElemId = new ElemID('salto', 'invalid')
    const beforeInvalidObj = new ObjectType({ elemID: invalidObjElemId })
    const afterInvalidObj = beforeInvalidObj.clone()
    afterInvalidObj.annotations.new = 'value'
    afterInvalidObj.annotationTypes.new = BuiltinTypes.STRING
    afterInvalidObj.fields.valid = new Field(afterInvalidObj, 'valid', BuiltinTypes.STRING)
    const planResult = await getPlan([...allElements, beforeInvalidObj],
      [...allElements, afterInvalidObj], { salto: mockChangeValidator })
    expect(planResult.changeErrors).toHaveLength(1)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(afterInvalidObj.elemID)).toBeTruthy()
    expect(planResult.size).toBe(1)
    const planItem = getFirstPlanItem(planResult)
    const changes = [...planItem.changes()]
    expect(changes).toHaveLength(1)
    expect(getChangeElement(changes[0])).toEqual(afterInvalidObj.fields.valid)
  })

  it('should have onUpdate change errors when only some field removals are invalid', async () => {
    const beforeElements = mock.getAllElements()
    const saltoOffice = beforeElements[2] as ObjectType
    saltoOffice.fields.invalid = new Field(saltoOffice, 'invalid', BuiltinTypes.STRING)
    saltoOffice.fields.valid = new Field(saltoOffice, 'valid', BuiltinTypes.STRING)
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
    beforeSaltoOffice.fields.invalid = new Field(beforeSaltoOffice, 'invalid',
      BuiltinTypes.STRING)
    const afterElements = mock.getAllElements()
    const afterSaltoOffice = afterElements[2] as ObjectType
    afterSaltoOffice.fields.invalid = new Field(afterSaltoOffice, 'invalid',
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
    beforeInvalidObj.fields.invalid = new Field(beforeInvalidObj, 'invalid',
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
})
