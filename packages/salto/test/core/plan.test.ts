import _ from 'lodash'
import wu from 'wu'
import {
  ElemID, ObjectType, Field, BuiltinTypes, InstanceElement,
  Change, getChangeElement,
} from 'adapter-api'
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
    wu(item.items.values()).find(change =>
      getChangeElement(change).elemID.getFullName() === elemID.getFullName())!
  const allElements = mock.getAllElements([])

  const planWithTypeChanges = (): [Plan, ObjectType] => {
    const afterElements = mock.getAllElements([])
    const saltoOffice = afterElements[2] as ObjectType
    saltoOffice.annotations.label = 'new label'
    saltoOffice.annotationTypes.new = BuiltinTypes.STRING
    saltoOffice.annotations.new = 'new annotation'
    const plan = getPlan(allElements, afterElements)
    return [plan, saltoOffice]
  }

  const planWithFieldChanges = (): [Plan, ObjectType] => {
    const afterElements = mock.getAllElements([])
    const saltoOffice = afterElements[2] as ObjectType
    // Adding new field
    saltoOffice.fields.new = new Field(saltoOffice.elemID, 'new', BuiltinTypes.STRING)
    // Sub element change
    saltoOffice.fields.location.annotations.label = 'new label'
    const plan = getPlan(allElements, afterElements)
    return [plan, saltoOffice]
  }

  const planWithNewType = (): [Plan, ObjectType] => {
    const newElemID = new ElemID('salto', 'additional')
    const newElement = new ObjectType({
      elemID: newElemID,
      fields: {
        country: new Field(newElemID, 'country', BuiltinTypes.STRING),
        city: new Field(newElemID, 'city', BuiltinTypes.STRING),
      },
    })
    const plan = getPlan(allElements, [...allElements, newElement])
    return [plan, newElement]
  }

  const planWithInstanceChange = (): [Plan, InstanceElement] => {
    const afterElements = mock.getAllElements([])
    const updatedEmployee = afterElements[4] as InstanceElement
    updatedEmployee.value.nicknames[1] = 'new'
    delete updatedEmployee.value.office.name
    const plan = getPlan(allElements, afterElements)
    return [plan, updatedEmployee]
  }

  it('should create empty plan', () => {
    const plan = getPlan(allElements, allElements)
    expect(plan.size).toBe(0)
  })

  it('should create plan with add change', () => {
    const [plan, newElement] = planWithNewType()
    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    expect(planItem.groupKey).toBe(newElement.elemID.getFullName())
    // We should only get the new type change, new fields are contained in it
    expect(planItem.items.size).toBe(1)
    const change = getChange(planItem, newElement.elemID)
    expect(change.action).toBe('add')
    expect(getChangeElement(change)).toEqual(newElement)
  })

  it('should create plan with remove change', () => {
    const pre = allElements
    const plan = getPlan(pre, pre.slice(0, pre.length - 1))
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

  it('should create plan with modification changes due to field changes', () => {
    const [plan, changedElem] = planWithFieldChanges()
    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    expect(planItem.groupKey).toBe(changedElem.elemID.getFullName())
    expect(getChange(planItem, changedElem.elemID)).toBeUndefined()
    expect(getChange(planItem, changedElem.fields.new.elemID).action).toBe('add')
    expect(getChange(planItem, changedElem.fields.location.elemID).action).toBe('modify')
  })

  it('should create plan with modification changes due to value change', () => {
    const post = mock.getAllElements()
    const employee = post[post.length - 1] as InstanceElement
    employee.value.name = 'SecondEmployee'
    const plan = getPlan(allElements, post)
    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    expect(planItem.groupKey).toBe(employee.elemID.getFullName())
    expect(getChange(planItem, employee.elemID).action).toBe('modify')
    expect(planItem.items.size).toBe(1)
  })
  it('should create plan with modification change in primary element (no inner changes)', () => {
    const [plan, changedElem] = planWithTypeChanges()

    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    expect(planItem.groupKey).toBe(changedElem.elemID.getFullName())
    expect(getChange(planItem, changedElem.elemID).action).toBe('modify')
    expect(planItem.items.size).toBe(1)
  })

  describe('PlanItem', () => {
    describe('parent method', () => {
      it('should return group level change', () => {
        const [plan, changedElem] = planWithTypeChanges()
        const planItem = getFirstPlanItem(plan)
        const groupLevelChange = getChange(planItem, changedElem.elemID)
        expect(planItem.parent()).toBe(groupLevelChange)
      })
      it('should craete modify parent if none exists', () => {
        const [plan, changedElem] = planWithFieldChanges()
        const planItem = getFirstPlanItem(plan)
        const parent = planItem.parent()
        expect(parent.action).toEqual('modify')
        expect(getChangeElement(parent).elemID).toEqual(changedElem.elemID)
      })
    })

    describe('detailedChange method', () => {
      it('should break field modification to specific value changes', () => {
        const [plan, newElement] = planWithTypeChanges()
        const planItem = getFirstPlanItem(plan)
        const changes = wu(planItem.detailedChanges()).toArray()
        expect(changes).toHaveLength(2)

        expect(changes[0].id.nameParts).toEqual(['office', 'label'])
        expect(changes[0].action).toEqual('add')
        expect(_.get(changes[0].data, 'after')).toEqual(newElement.annotations.label)

        expect(changes[1].id.nameParts).toEqual(['office', 'new'])
        expect(changes[1].action).toEqual('add')
        expect(_.get(changes[1].data, 'after')).toEqual(newElement.annotations.new)
      })
      it('should return add / remove changes at the appropriate level', () => {
        const [plan, newElement] = planWithNewType()
        const planItem = getFirstPlanItem(plan)
        const changes = wu(planItem.detailedChanges()).toArray()
        expect(changes).toHaveLength(1)
        expect(changes[0].id).toEqual(newElement.elemID)
      })
      it('should return deep nested changes', () => {
        const [plan, updatedInst] = planWithInstanceChange()
        const planItem = getFirstPlanItem(plan)
        const changes = wu(planItem.detailedChanges()).toArray()
        expect(changes).toHaveLength(2)
        const [listChange, nameRemove] = changes
        expect(listChange.action).toEqual('modify')
        expect(listChange.id.nameParts).toEqual([updatedInst.elemID.name, 'nicknames', '1'])
        expect(nameRemove.action).toEqual('remove')
        expect(nameRemove.id.nameParts).toEqual([updatedInst.elemID.name, 'office', 'name'])
      })
    })
  })
})
