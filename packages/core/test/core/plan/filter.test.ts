/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { getChangeData, ChangeValidator, ObjectType, ElemID, InstanceElement, Field, BuiltinTypes, ChangeDataType, Change, createRefToElmWithValue, isDependencyError, isField } from '@salto-io/adapter-api'
import wu, { WuIterable } from 'wu'
import { mockFunction } from '@salto-io/test-utils'
import * as mock from '../../common/elements'
import { getFirstPlanItem } from '../../common/plan'
import { getPlan } from '../../../src/core/plan'
import { createElementSource } from '../../common/helpers'

describe('filterInvalidChanges', () => {
  const allElements = mock.getAllElements()

  const mockChangeValidator = mockFunction<ChangeValidator>().mockImplementation(
    async changes => changes
      .map(getChangeData)
      .filter(elem => elem.elemID.name.includes('invalid'))
      .map(({ elemID }) => ({ elemID, severity: 'Error', message: 'msg', detailedMessage: '' }))
  )

  it('should have no change errors when having no diffs', async () => {
    const planResult = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(allElements),
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
      before: createElementSource(allElements),
      after: createElementSource([...allElements, ...newElements]),
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors).toHaveLength(0)
    expect(planResult.size).toBe(2)
    newElements.forEach(element => {
      const oldElement = (wu(planResult.itemsByEvalOrder())
        .map(item => item.changes())
        .flatten(true) as WuIterable<Change<ChangeDataType>>)
        .map(getChangeData)
        .find(changeData => element.elemID.isEqual(changeData.elemID))
      expect(oldElement).toBeDefined()
    })
  })

  it('should have onAdd change errors and omit invalid object & instance addition', async () => {
    const newInvalidObj = new ObjectType({
      elemID: new ElemID('salto', 'new_invalid_obj'),
      fields: {
        valid: { refType: BuiltinTypes.STRING },
        invalid: { refType: BuiltinTypes.STRING },
      },
      annotations: { value: 'value' },
    })
    const newInvalidInst = new InstanceElement('new_invalid_inst', newInvalidObj, {})
    const planResult = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource([...allElements, newInvalidObj, newInvalidInst]),
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(3)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(4)
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
        valid: { refType: BuiltinTypes.STRING },
        invalid: { refType: BuiltinTypes.STRING },
      },
      annotations: { value: 'value' },
    })
    const planResult = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource([...allElements, newValidObj]),
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(1)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(0)
    expect(planResult.changeErrors[0].elemID.isEqual(newValidObj.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.changeErrors[0].severity === 'Error').toBeTruthy()
    expect(planResult.size).toBe(1)
    const planItem = getFirstPlanItem(planResult)
    expect(planItem.items.size).toBe(1)
    const [change] = planItem.changes() as Change<ObjectType>[]
    const parentFields = Object.keys(getChangeData(change).fields)
    expect(parentFields).toContain('valid')
    expect(parentFields).not.toContain('invalid')
  })

  it('should have onUpdate change errors when all changes are invalid', async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2] as ObjectType
    saltoOffice.fields.invalid = new Field(saltoOffice, 'invalid', BuiltinTypes.STRING)
    const planResult = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(afterElements),
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(1)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(0)
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
      before: createElementSource(allElements),
      after: createElementSource(afterElements),
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(1)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(0)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(saltoOffice.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.size).toBe(1)
    const planItem = getFirstPlanItem(planResult)
    expect(planItem.items.size).toBe(1)
    const [change] = planItem.changes()
    expect(change.action).toEqual('add')
    const changedField = getChangeData(change) as Field
    expect(changedField.elemID).toEqual(saltoOffice.fields.valid.elemID)
    // It should replace the field parent with a parent that does not have invalid changes
    expect(changedField.parent.fields).not.toHaveProperty('invalid')
  })

  it('should have onUpdate change error when modifying invalid object annotations and keep the creation of valid field', async () => {
    const invalidObjElemId = new ElemID('salto', 'invalid')
    const beforeInvalidObj = new ObjectType({ elemID: invalidObjElemId })
    const afterInvalidObj = beforeInvalidObj.clone()
    afterInvalidObj.annotations.new = 'value'
    afterInvalidObj.annotationRefTypes.new = createRefToElmWithValue(BuiltinTypes.STRING)
    afterInvalidObj.fields.valid = new Field(afterInvalidObj, 'valid', BuiltinTypes.STRING)
    const planResult = await getPlan({
      before: createElementSource([...allElements, beforeInvalidObj]),
      after: createElementSource([...allElements, afterInvalidObj]),
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(1)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(0)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(afterInvalidObj.elemID)).toBeTruthy()
    expect(planResult.size).toBe(1)
    const planItem = getFirstPlanItem(planResult)
    expect(planItem.items.size).toBe(1)
    const [change] = planItem.changes()
    expect(change.action).toEqual('add')
    const afterValidObj = beforeInvalidObj.clone()
    afterValidObj.fields.valid = new Field(afterValidObj, 'valid', BuiltinTypes.STRING)
    const changeData = getChangeData(change)
    expect(isField(changeData) && changeData.parent.isEqual(afterValidObj)).toBeTruthy()
  })

  it('should have onUpdate change errors when only some elements are invalid', async () => {
    const afterElements = mock.getAllElements()
    const saltoAddr = afterElements[1]
    saltoAddr.annotate({ valid: true })
    const saltoOffice = afterElements[2]
    saltoOffice.fields.invalid = new Field(saltoOffice, 'invalid', BuiltinTypes.STRING)
    const saltoEmployeeInstance = afterElements[4]
    saltoEmployeeInstance.value.valid = true
    const planResult = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(afterElements),
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(1)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(0)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(saltoOffice.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.size).toBe(2)
  })

  it('should have onUpdate change errors when only some field removals are invalid', async () => {
    const beforeElements = mock.getAllElements()
    const saltoOffice = beforeElements[2] as ObjectType
    saltoOffice.fields.invalid = new Field(saltoOffice, 'invalid', BuiltinTypes.STRING)
    saltoOffice.fields.valid = new Field(saltoOffice, 'valid', BuiltinTypes.STRING)
    const planResult = await getPlan({
      before: createElementSource(beforeElements),
      after: createElementSource(allElements),
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(1)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(0)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(saltoOffice.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.size).toBe(1)
    const planItem = getFirstPlanItem(planResult)
    expect(planItem.items.size).toBe(1)
    const [change] = planItem.changes()
    expect(change.action).toEqual('remove')
    expect(getChangeData(change)).toEqual(saltoOffice.fields.valid)
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
      before: createElementSource(beforeElements),
      after: createElementSource(afterElements),
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(1)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(0)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(afterSaltoOffice.fields.invalid.elemID))
      .toBeTruthy()
    expect(planResult.size).toBe(0)
  })

  it('should have onUpdate change errors when modifying values inside an instance', async () => {
    const afterElements = mock.getAllElements()
    const saltoEmployeeInstance = afterElements[4] as InstanceElement
    saltoEmployeeInstance.value.office.seats.invalid = 'anotherSeat'
    const seatsId = saltoEmployeeInstance.elemID.createNestedID('office', 'seats')
    const mockMapValueChangeValidator = mockFunction<ChangeValidator>().mockImplementation(
      async changes => changes
        .map(getChangeData)
        .filter(elem => elem.elemID.isEqual(saltoEmployeeInstance.elemID))
        .map(({ elemID }) => ({
          elemID: elemID.createNestedID('office', 'seats'),
          severity: 'Error',
          message: 'msg',
          detailedMessage: '',
        }))
    )

    const planResult = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(afterElements),
      changeValidators: { salto: mockMapValueChangeValidator },
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(1)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(0)
    expect(planResult.changeErrors[0].severity).toEqual('Error')
    expect(planResult.changeErrors[0].elemID.isEqual(seatsId)).toBeTruthy()
    expect(planResult.size).toBe(0)
  })

  it('should have onRemove change errors', async () => {
    const beforeInvalidObj = new ObjectType({
      elemID: new ElemID('salto', 'before_invalid_obj'),
      fields: {
        invalid: { refType: BuiltinTypes.STRING },
      },
    })
    const beforeInvalidField = beforeInvalidObj.fields.invalid
    const beforeInvalidInst = new InstanceElement('before_invalid_inst', beforeInvalidObj, {})
    const planResult = await getPlan({
      before: createElementSource(
        [...allElements, beforeInvalidObj, beforeInvalidInst]
      ),
      after: createElementSource(allElements),
      changeValidators: { salto: mockChangeValidator },
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(3)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(3)
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(beforeInvalidObj.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(beforeInvalidField.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.some(v => v.elemID.isEqual(beforeInvalidInst.elemID)))
      .toBeTruthy()
    expect(planResult.changeErrors.every(v => v.severity === 'Error')).toBeTruthy()
    expect(planResult.size).toBe(0)
  })

  it('should include nodes that were dropped due to a dependency to an error node', async () => {
    const newInvalidObj = new ObjectType({
      elemID: new ElemID('salto', 'new_invalid_obj'),
      fields: {
        valid: { refType: BuiltinTypes.STRING },
      },
      annotations: { value: 'value' },
    })
    const newDependentInst = new InstanceElement('valid', newInvalidObj, {})
    const planResult = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource([...allElements, newInvalidObj, newDependentInst]),
      changeValidators: { salto: mockChangeValidator },
      dependencyChangers: [async () => wu([
        {
          action: 'add',
          dependency: {
            source: `${newDependentInst.elemID.getFullName()}/add`,
            target: `${newInvalidObj.elemID.getFullName()}/add`,
          },
        },
      ])],
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(1)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(1)
    const objErr = planResult.changeErrors.filter(err => !isDependencyError(err))[0]
    const depErr = planResult.changeErrors.filter(err => isDependencyError(err))[0]
    expect(objErr.elemID.isEqual(newInvalidObj.elemID))
      .toBeTruthy()
    expect(depErr.severity === 'Error').toBeTruthy()
    expect(depErr.elemID.isEqual(newDependentInst.elemID))
      .toBeTruthy()
    expect(depErr.message).toEqual('Element cannot be deployed due to an error in its dependency')
    expect(depErr.severity === 'Error').toBeTruthy()
    expect(planResult.size).toBe(1)
    const planItem = getFirstPlanItem(planResult)
    expect(planItem.items.size).toBe(1)
  })

  it('should include dependency error and actual error if a change has both', async () => {
    const newInvalidObj = new ObjectType({
      elemID: new ElemID('salto', 'new_invalid_obj'),
      fields: {
        valid: { refType: BuiltinTypes.STRING },
      },
      annotations: { value: 'value' },
    })
    const newInvalidDependentInst = new InstanceElement('invalid', newInvalidObj, {})
    const planResult = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource([...allElements, newInvalidObj, newInvalidDependentInst]),
      changeValidators: { salto: mockChangeValidator },
      dependencyChangers: [async () => wu([
        {
          action: 'add',
          dependency: {
            source: `${newInvalidDependentInst.elemID.getFullName()}/add`,
            target: `${newInvalidObj.elemID.getFullName()}/add`,
          },
        },
      ])],
    })
    expect(planResult.changeErrors.filter(err => !isDependencyError(err))).toHaveLength(2)
    expect(planResult.changeErrors.filter(err => isDependencyError(err))).toHaveLength(1)
    const [objErr, instErr] = planResult.changeErrors.filter(err => !isDependencyError(err))
    const depErr = planResult.changeErrors.filter(err => isDependencyError(err))[0]
    expect(objErr.elemID.isEqual(newInvalidObj.elemID))
      .toBeTruthy()
    expect(instErr.elemID.isEqual(newInvalidDependentInst.elemID))
      .toBeTruthy()
    expect(depErr.severity === 'Error').toBeTruthy()
    expect(depErr.elemID.isEqual(newInvalidDependentInst.elemID))
      .toBeTruthy()
    expect(depErr.severity === 'Error').toBeTruthy()
    expect(planResult.size).toBe(1)
    const planItem = getFirstPlanItem(planResult)
    expect(planItem.items.size).toBe(1)
  })
})
