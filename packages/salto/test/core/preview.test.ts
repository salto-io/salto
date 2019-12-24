import _ from 'lodash'
import wu from 'wu'
import {
  ElemID, ObjectType, Field, BuiltinTypes, InstanceElement, Change, getChangeElement, PrimitiveType,
  PrimitiveTypes, ChangeError, ChangeValidator, Element, isObjectType,
} from 'adapter-api'
import { AdditionDiff, ModificationDiff } from '@salto/dag'
import * as mock from '../common/elements'
import {
  getPlan, Plan, PlanItem,
} from '../../src/core/plan'

jest.mock('../../src/state/state')

describe('getPlan', () => {
  const getFirstPlanItem = (plan: Plan): PlanItem =>
    wu(plan.itemsByEvalOrder()).next().value

  const getChange = (item: PlanItem, elemID: ElemID): Change =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    wu(item.changes()).find(change => getChangeElement(change).elemID.isEqual(elemID))!
  const allElements = mock.getAllElements()

  const planWithTypeChanges = async (): Promise<[Plan, ObjectType]> => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2] as ObjectType
    saltoOffice.annotations.label = 'new label'
    saltoOffice.annotations.new = 'new annotation'
    const plan = await getPlan(allElements, afterElements)
    return [plan, saltoOffice]
  }

  const planWithFieldChanges = async (): Promise<[Plan, ObjectType]> => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2] as ObjectType
    // Adding new field
    saltoOffice.fields.new = new Field(saltoOffice.elemID, 'new', BuiltinTypes.STRING)
    // Sub element change
    saltoOffice.fields.location.annotations.label = 'new label'
    const plan = await getPlan(allElements, afterElements)
    return [plan, saltoOffice]
  }

  const planWithNewType = async (): Promise<[Plan, PrimitiveType]> => {
    const newElement = new PrimitiveType({
      elemID: new ElemID('salto', 'additional'),
      primitive: PrimitiveTypes.STRING,
    })
    const plan = await getPlan(allElements, [...allElements, newElement])
    return [plan, newElement]
  }

  const planWithInstanceChange = async (): Promise<[Plan, InstanceElement]> => {
    const afterElements = mock.getAllElements()
    const updatedEmployee = afterElements[4] as InstanceElement
    updatedEmployee.value.nicknames[1] = 'new'
    delete updatedEmployee.value.office.name
    const plan = await getPlan(allElements, afterElements)
    return [plan, updatedEmployee]
  }

  const planWithListChange = async (): Promise<[Plan, InstanceElement]> => {
    const afterElements = mock.getAllElements()
    const updatedEmployee = afterElements[4] as InstanceElement
    updatedEmployee.value.nicknames.push('new')
    const plan = await getPlan(allElements, afterElements)
    return [plan, updatedEmployee]
  }

  const planWithAnnotationTypesChanges = async (): Promise<[Plan, ObjectType]> => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2] as ObjectType
    // update existing field
    saltoOffice.fields.name.annotations.new = 'new'
    // update annotation types
    saltoOffice.annotationTypes.new = BuiltinTypes.STRING
    const plan = await getPlan(allElements, afterElements)
    return [plan, saltoOffice]
  }
  const planWithFieldIsListChanges = async (): Promise<[Plan, ObjectType]> => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2] as ObjectType
    // Adding new field
    saltoOffice.fields.name.isList = true
    const plan = await getPlan(allElements, afterElements)
    return [plan, saltoOffice]
  }

  it('should create empty plan', async () => {
    const plan = await getPlan(allElements, allElements)
    expect(plan.size).toBe(0)
  })

  it('should create plan with add change', async () => {
    const [plan, newElement] = await planWithNewType()
    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    expect(planItem.groupKey).toBe(newElement.elemID.getFullName())
    // We should only get the new type change, new fields are contained in it
    expect(planItem.items.size).toBe(1)
    const change = getChange(planItem, newElement.elemID)
    expect(change.action).toBe('add')
    expect(getChangeElement(change)).toEqual(newElement)
  })

  it('should create plan with remove change', async () => {
    const pre = allElements
    const plan = await getPlan(pre, pre.slice(0, pre.length - 1))
    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    const removed = pre[pre.length - 1]
    expect(planItem.groupKey).toBe(removed.elemID.getFullName())
    const removedChange = getChange(planItem, removed.elemID)
    expect(removedChange.action).toBe('remove')
    if (removedChange.action === 'remove') {
      expect(removedChange.data.before).toEqual(removed)
    }
  })

  it('should create plan with modification changes due to field changes', async () => {
    const [plan, changedElem] = await planWithFieldChanges()
    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    expect(planItem.groupKey).toBe(changedElem.elemID.getFullName())
    expect(getChange(planItem, changedElem.elemID)).toBeUndefined()
    expect(getChange(planItem, changedElem.fields.new.elemID).action).toBe('add')
    expect(getChange(planItem, changedElem.fields.location.elemID).action).toBe('modify')
  })

  it('should create plan with modification changes due to value change', async () => {
    const post = mock.getAllElements()
    const employee = post[4] as InstanceElement
    employee.value.name = 'SecondEmployee'
    const plan = await getPlan(allElements, post)
    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    expect(planItem.groupKey).toBe(employee.elemID.getFullName())
    expect(getChange(planItem, employee.elemID).action).toBe('modify')
    expect(planItem.items.size).toBe(1)
  })
  it('should create plan with modification change in primary element (no inner changes)', async () => {
    const [plan, changedElem] = await planWithTypeChanges()

    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    expect(planItem.groupKey).toBe(changedElem.elemID.getFullName())
    expect(getChange(planItem, changedElem.elemID).action).toBe('modify')
    expect(planItem.items.size).toBe(1)
  })

  describe('PlanItem', () => {
    describe('parent method', () => {
      it('should return group level change', async () => {
        const [plan, changedElem] = await planWithTypeChanges()
        const planItem = getFirstPlanItem(plan)
        const groupLevelChange = getChange(planItem, changedElem.elemID)
        expect(planItem.parent()).toBe(groupLevelChange)
      })
      it('should create modify parent if none exists', async () => {
        const [plan, changedElem] = await planWithFieldChanges()
        const planItem = getFirstPlanItem(plan)
        const parent = planItem.parent()
        expect(parent.action).toEqual('modify')
        expect(getChangeElement(parent).elemID).toEqual(changedElem.elemID)
      })
    })

    describe('detailedChange method', () => {
      it('should break field modification to specific value changes', async () => {
        const [plan, newElement] = await planWithTypeChanges()
        const planItem = getFirstPlanItem(plan)
        const changes = [...planItem.detailedChanges()]
        expect(changes).toHaveLength(2)

        expect(changes[0].id).toEqual(newElement.elemID.createNestedID('attr', 'label'))
        expect(changes[0].action).toEqual('add')
        expect(_.get(changes[0].data, 'after')).toEqual(newElement.annotations.label)

        expect(changes[1].id).toEqual(newElement.elemID.createNestedID('attr', 'new'))
        expect(changes[1].action).toEqual('add')
        expect(_.get(changes[1].data, 'after')).toEqual(newElement.annotations.new)
      })
      it('should return field changes with the correct id', async () => {
        const [plan, newElement] = await planWithFieldChanges()
        const planItem = getFirstPlanItem(plan)
        const changes = [...planItem.detailedChanges()]
        expect(changes).toHaveLength(2)

        expect(changes[0].id).toEqual(newElement.fields.new.elemID)
        expect(changes[0].action).toEqual('add')

        expect(changes[1].id).toEqual(newElement.fields.location.elemID.createNestedID('label'))
        expect(changes[1].action).toEqual('modify')
        expect(_.get(changes[1].data, 'after')).toEqual(newElement.fields.location.annotations.label)
      })
      it('should return add / remove changes at the appropriate level', async () => {
        const [plan, newElement] = await planWithNewType()
        const planItem = getFirstPlanItem(plan)
        const changes = [...planItem.detailedChanges()]
        expect(changes).toHaveLength(1)
        expect(changes[0].id).toEqual(newElement.elemID)
      })
      it('should return deep nested changes', async () => {
        const [plan, updatedInst] = await planWithInstanceChange()
        const planItem = getFirstPlanItem(plan)
        const changes = [...planItem.detailedChanges()]
        expect(changes).toHaveLength(2)
        const [listChange, nameRemove] = changes
        expect(listChange.action).toEqual('modify')
        expect(listChange.id).toEqual(updatedInst.elemID.createNestedID('nicknames', '1'))
        expect(nameRemove.action).toEqual('remove')
        expect(nameRemove.id).toEqual(updatedInst.elemID.createNestedID('office', 'name'))
      })
      it('should return list modification when a value is added', async () => {
        const [plan, updatedInst] = await planWithListChange()
        const planItem = getFirstPlanItem(plan)
        const changes = [...planItem.detailedChanges()]
        expect(changes).toHaveLength(1)
        const [listChange] = changes
        expect(listChange.action).toEqual('modify')
        expect(listChange.id).toEqual(updatedInst.elemID.createNestedID('nicknames'))
      })

      it('should return only top level change in case of annotationType change', async () => {
        const [plan, obj] = await planWithAnnotationTypesChanges()
        const planItem = getFirstPlanItem(plan)
        const changes = [...planItem.detailedChanges()]
        expect(changes).toHaveLength(1)
        const [annoChange] = changes
        expect(annoChange.action).toEqual('modify')
        expect(annoChange.id).toEqual(obj.elemID)
      })

      it('should return is list value modification when a field is changed to list', async () => {
        const [plan, changedElem] = await planWithFieldIsListChanges()
        const planItem = getFirstPlanItem(plan)
        const changes = wu(planItem.detailedChanges()).toArray()
        expect(changes).toHaveLength(1)
        const [listChange] = changes
        expect(listChange.action).toEqual('modify')
        expect(listChange.id).toEqual(changedElem.fields.name.elemID)
        expect(_.get(listChange.data, 'after').isList).toBe(true)
      })
    })
  })

  describe('change errors', () => {
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
})
