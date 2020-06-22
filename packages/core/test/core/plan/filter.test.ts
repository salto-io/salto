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
import { AdditionDiff, ModificationDiff } from '@salto-io/dag'
import {
  getChangeElement, ChangeValidator, ObjectType, ElemID, InstanceElement, Field, BuiltinTypes,
} from '@salto-io/adapter-api'
import wu from 'wu'
import * as mock from '../../common/elements'
import { getFirstPlanItem } from '../../common/plan'
import { getPlan } from '../../../src/core/plan'
import { mockFunction } from '../../common/helpers'


describe('filterInvalidChanges', () => {
  const allElements = mock.getAllElements()


  const mockChangeValidator = mockFunction<ChangeValidator>().mockImplementation(
    async changes => changes
      .map(getChangeElement)
      .filter(elem => elem.elemID.name.includes('invalid'))
      .map(({ elemID }) => ({ elemID, severity: 'Error', message: 'msg', detailedMessage: '' }))
  )

  it('should have no change errors when having no diffs', async () => {
    const planResult = await getPlan({
      before: allElements,
      after: allElements,
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors).toHaveLength(0)
    expect(planResult.size).toBe(0)
  })

  it('should have no change errors when having only valid changes', async () => {
    const newValidObj = new ObjectType({ elemID: new ElemID('salto', 'new_valid_obj') })
    const newValidInst = new InstanceElement('new_valid_inst', newValidObj, {})
    const newValidSetting = new ObjectType({
      elemID: new ElemID('salto', 'new_valid_obj'),
      isSettings: true,
    })
    const newElements = [newValidObj, newValidInst, newValidSetting]
    const planResult = await getPlan({
      before: allElements,
      after: [...allElements, ...newElements],
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors).toHaveLength(0)
    expect(planResult.size).toBe(2)
    newElements.forEach(element => {
      const oldElement = wu(planResult.itemsByEvalOrder())
        .map(item => getChangeElement(item.parent()))
        .find(changeElement => element.elemID.isEqual(changeElement.elemID))
      expect(oldElement).toBeDefined()
    })
  })

  it('should have onAdd change errors and omit invalid object & instance addition', async () => {
    const newInvalidObj = new ObjectType({
      elemID: new ElemID('salto', 'new_invalid_obj'),
      fields: {
        valid: { type: BuiltinTypes.STRING },
        invalid: { type: BuiltinTypes.STRING },
      },
      annotations: { value: 'value' },
    })
    const newInvalidInst = new InstanceElement('new_invalid_inst', newInvalidObj, {})
    const planResult = await getPlan({
      before: allElements,
      after: [...allElements, newInvalidObj, newInvalidInst],
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors).toHaveLength(3)
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(newInvalidObj.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(newInvalidObj.fields.invalid.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(newInvalidInst.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.every(v => v.severity === 'Error')).toBeTruthy()
    expect(planResult.size).toBe(0)
  })

  it('should have onAdd change errors and omit invalid fields', async () => {
    const newValidObj = new ObjectType({
      elemID: new ElemID('salto', 'new_valid_obj'),
      fields: {
        valid: { type: BuiltinTypes.STRING },
        invalid: { type: BuiltinTypes.STRING },
      },
      annotations: { value: 'value' },
    })
    const planResult = await getPlan({
      before: allElements,
      after: [...allElements, newValidObj],
      changeValidators: { salto: mockChangeValidator },
    })
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
    const planResult = await getPlan({
      before: allElements,
      after: afterElements,
      changeValidators: { salto: mockChangeValidator },
    })
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
    const planResult = await getPlan({
      before: allElements,
      after: afterElements,
      changeValidators: { salto: mockChangeValidator },
    })
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
    const planResult = await getPlan({
      before: [...allElements, beforeInvalidObj],
      after: [...allElements, afterInvalidObj],
      changeValidators: { salto: mockChangeValidator },
    })
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
    const planResult = await getPlan({
      before: beforeElements,
      after: allElements,
      changeValidators: { salto: mockChangeValidator },
    })
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
    const planResult = await getPlan({
      before: beforeElements,
      after: afterElements,
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors).toHaveLength(1)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(afterSaltoOffice.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.size).toBe(0)
  })

  it('should have onRemove change errors', async () => {
    const beforeInvalidObj = new ObjectType({
      elemID: new ElemID('salto', 'before_invalid_obj'),
      fields: {
        invalid: { type: BuiltinTypes.STRING },
      },
    })
    const beforeInvalidField = beforeInvalidObj.fields.invalid
    const beforeInvalidInst = new InstanceElement('before_invalid_inst', beforeInvalidObj, {})
    const planResult = await getPlan({
      before: [...allElements, beforeInvalidObj, beforeInvalidInst],
      after: allElements,
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors).toHaveLength(3)
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(beforeInvalidObj.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(beforeInvalidField.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(beforeInvalidInst.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.every(v => v.severity === 'Error')).toBeTruthy()
    expect(planResult.size).toBe(0)
  })
})
