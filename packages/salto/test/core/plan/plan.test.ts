import {
  ElemID, ObjectType, Field, BuiltinTypes, InstanceElement, getChangeElement, PrimitiveType,
  PrimitiveTypes,
  Element,
} from 'adapter-api'
import * as mock from '../../common/elements'
import { getFirstPlanItem, getChange } from '../../common/plan'
import { getPlan, Plan } from '../../../src/core/plan'

type PlanGenerators = {
  planWithTypeChanges: () => Promise<[Plan, ObjectType]>
  planWithFieldChanges: () => Promise<[Plan, ObjectType]>
  planWithNewType: () => Promise<[Plan, PrimitiveType]>
  planWithInstanceChange: () => Promise<[Plan, InstanceElement]>
  planWithListChange: () => Promise<[Plan, InstanceElement]>
  planWithAnnotationTypesChanges: () => Promise<[Plan, ObjectType]>
  planWithFieldIsListChanges: () => Promise<[Plan, ObjectType]>
}

export const planGenerators = (allElements: ReadonlyArray<Element>): PlanGenerators => ({
  planWithTypeChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    saltoOffice.annotations.label = 'new label'
    saltoOffice.annotations.new = 'new annotation'
    const plan = await getPlan(allElements, afterElements)
    return [plan, saltoOffice]
  },

  planWithFieldChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    // Adding new field
    saltoOffice.fields.new = new Field(saltoOffice.elemID, 'new', BuiltinTypes.STRING)
    // Sub element change
    saltoOffice.fields.location.annotations.label = 'new label'
    const plan = await getPlan(allElements, afterElements)
    return [plan, saltoOffice]
  },

  planWithNewType: async () => {
    const newElement = new PrimitiveType({
      elemID: new ElemID('salto', 'additional'),
      primitive: PrimitiveTypes.STRING,
    })
    const plan = await getPlan(allElements, [...allElements, newElement])
    return [plan, newElement]
  },

  planWithInstanceChange: async () => {
    const afterElements = mock.getAllElements()
    const updatedEmployee = afterElements[4]
    updatedEmployee.value.nicknames[1] = 'new'
    delete updatedEmployee.value.office.name
    const plan = await getPlan(allElements, afterElements)
    return [plan, updatedEmployee]
  },

  planWithListChange: async () => {
    const afterElements = mock.getAllElements()
    const updatedEmployee = afterElements[4]
    updatedEmployee.value.nicknames.push('new')
    const plan = await getPlan(allElements, afterElements)
    return [plan, updatedEmployee]
  },

  planWithAnnotationTypesChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    // update annotation types
    saltoOffice.annotationTypes.new = BuiltinTypes.STRING
    const plan = await getPlan(allElements, afterElements)
    return [plan, saltoOffice]
  },

  planWithFieldIsListChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    // Adding new field
    saltoOffice.fields.name.isList = true
    const plan = await getPlan(allElements, afterElements)
    return [plan, saltoOffice]
  },
})

describe('getPlan', () => {
  const allElements = mock.getAllElements()

  const {
    planWithTypeChanges,
    planWithFieldChanges,
    planWithNewType,
  } = planGenerators(allElements)

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
    const employee = post[4]
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
})
