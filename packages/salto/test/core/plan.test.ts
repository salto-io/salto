import _ from 'lodash'
import wu from 'wu'
import {
  ElemID, ObjectType, Field, BuiltinTypes, Type, InstanceElement,
  Change, getChangeElement,
} from 'adapter-api'
import State from '../../src/state/state'
import * as coreMock from './mocks/core'
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

  it('should create empty plan', async () => {
    const allElements = await coreMock.getAllElements([])
    const plan = getPlan(allElements, allElements)
    expect(plan.size).toBe(0)
  })

  it('should create plan with add change', async () => {
    const allElements = await coreMock.getAllElements([])
    const newElemID = new ElemID('salto', 'additional')
    const newElement = new ObjectType({
      elemID: newElemID,
      fields: {
        country: new Field(newElemID, 'country', BuiltinTypes.STRING),
        city: new Field(newElemID, 'city', BuiltinTypes.STRING),
      },
    })
    const state = new State()
    state.get = jest.fn().mockImplementation(() => allElements)
    const plan = getPlan(allElements, [...allElements, newElement])
    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    expect(planItem.groupKey).toBe(newElemID.getFullName())
    expect(planItem.items.size).toBe(3)
    const change = getChange(planItem, newElemID)
    expect(change.action).toBe('add')
    // Adding those if's  below to prevent ts errors
    if (change.action === 'add') {
      expect(change.data.after).toEqual(newElement)
    }
    // Field country validation
    const countryChange = getChange(planItem, newElement.fields.country.elemID)
    expect(countryChange.action).toBe('add')
    if (countryChange.action === 'add') {
      expect(countryChange.data.after).toEqual(newElement.fields.country)
    }

    // Field city validation
    const cityChange = getChange(planItem, newElement.fields.city.elemID)
    expect(cityChange.action).toBe('add')
    if (cityChange.action === 'add') {
      expect(cityChange.data.after).toEqual(newElement.fields.city)
    }
  })

  it('should create plan with remove change', async () => {
    const pre = await coreMock.getAllElements([])
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

  it('should create plan with modification changes due to field changes', async () => {
    const pre = await coreMock.getAllElements([])
    const post = _.cloneDeep(pre)
    const employee = post[post.length - 2] as ObjectType
    // Adding new field
    employee.fields.new = new Field(employee.elemID, 'new', BuiltinTypes.STRING)
    // Changing existng field
    employee.fields.name.getAnnotationsValues()[Type.REQUIRED] = false
    const plan = getPlan(pre, post)
    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    expect(planItem.groupKey).toBe(employee.elemID.getFullName())
    expect(getChange(planItem, employee.elemID)).toBeUndefined()
    expect(getChange(planItem, employee.fields.new.elemID).action).toBe('add')
    expect(getChange(planItem, employee.fields.name.elemID).action).toBe('modify')
  })

  it('should create plan with modification changes due to value change', async () => {
    const pre = await coreMock.getAllElements([])
    const post = _.cloneDeep(pre)
    const employee = post[post.length - 1] as InstanceElement
    employee.value.name = 'SecondEmployee'
    const plan = getPlan(pre, post)
    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    expect(planItem.groupKey).toBe(employee.elemID.getFullName())
    expect(getChange(planItem, employee.elemID).action).toBe('modify')
    expect(planItem.items.size).toBe(1)
  })
  it('should create plan with modification change in primary element (no inner changes)',
    async () => {
      const pre = await coreMock.getAllElements([])
      const post = _.cloneDeep(pre)
      const employee = post[post.length - 2] as ObjectType
      employee.annotations.new = BuiltinTypes.STRING
      employee.annotate({ new: 'new' })
      const plan = getPlan(pre, post)

      expect(plan.size).toBe(1)
      const planItem = getFirstPlanItem(plan)
      expect(planItem.groupKey).toBe(employee.elemID.getFullName())
      expect(getChange(planItem, employee.elemID).action).toBe('modify')
      expect(planItem.items.size).toBe(1)
    })
})
