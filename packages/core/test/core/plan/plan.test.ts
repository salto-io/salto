/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { InstanceElement, getChangeElement, isInstanceElement, ChangeGroupIdFunction } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import * as mock from '../../common/elements'
import { getFirstPlanItem, getChange } from '../../common/plan'
import { createElementSource } from '../../common/helpers'
import { getPlan, Plan, PlanItem } from '../../../src/core/plan'
import { planGenerators } from '../../common/plan_generator'

describe('getPlan', () => {
  const allElements = mock.getAllElements()

  const {
    planWithTypeChanges,
    planWithFieldChanges,
    planWithNewType,
    planWithSplitElem,
    planWithDependencyCycle,
    planWithDependencyCycleWithinAGroup,
  } = planGenerators(allElements)

  it('should create empty plan', async () => {
    const plan = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(allElements),
    })
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
    const preFiltered = pre.filter(element => element.elemID.name !== 'instance')
    const plan = await getPlan({
      before: createElementSource(pre),
      after: createElementSource(preFiltered),
    })
    expect(plan.size).toBe(1)
    const planItem = getFirstPlanItem(plan)
    const removed = _.find(pre, element => element.elemID.name === 'instance')
    expect(isInstanceElement(removed)).toBeTruthy()
    expect(planItem.groupKey).toBe((removed as InstanceElement).elemID.getFullName())
    const removedChange = getChange(planItem, (removed as InstanceElement).elemID)
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
    const plan = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(post),
    })
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

  it('should split elements on addition if their fields create a dependency cycle', async () => {
    const [plan, splitElem] = await planWithSplitElem(true)
    const planItems = [...plan.itemsByEvalOrder()]
    expect(planItems).toHaveLength(6)
    const splitElemChanges = planItems
      .filter(item => item.groupKey === splitElem.elemID.getFullName())
    expect(splitElemChanges).toHaveLength(2)
    expect(splitElemChanges[0].action).toEqual('add')
    expect(splitElemChanges[1].action).toEqual('modify')
  })

  it('should split elements on removal if their fields create a dependency cycle', async () => {
    const [plan, splitElem] = await planWithSplitElem(false)

    const planItems = [...plan.itemsByEvalOrder()]
    expect(planItems).toHaveLength(6)
    const splitElemChanges = planItems
      .filter(item => item.groupKey === splitElem.elemID.getFullName())
    expect(splitElemChanges).toHaveLength(2)
    expect(splitElemChanges[0].action).toEqual('modify')
    expect(splitElemChanges[1].action).toEqual('remove')
  })

  it('should fail when plan has dependency cycle', async () => {
    // Without change validators
    await expect(planWithDependencyCycle(false)).rejects.toThrow()
    // With change validators
    await expect(planWithDependencyCycle(true)).rejects.toThrow()
  })

  it('should ignore cycles within a group', async () => {
    const plan = await planWithDependencyCycleWithinAGroup(false)
    const planItems = [...plan.itemsByEvalOrder()]
    expect(planItems).toHaveLength(5)
  })

  it('should ignore cycles within a group with change validators', async () => {
    const plan = await planWithDependencyCycleWithinAGroup(true)
    const planItems = [...plan.itemsByEvalOrder()]
    expect(planItems).toHaveLength(5)
  })

  describe('with custom group key function', () => {
    let plan: Plan
    let changeGroup: PlanItem
    const dummyGroupKeyFunc = mockFunction<ChangeGroupIdFunction>().mockResolvedValue(new Map())
    beforeAll(async () => {
      const before = mock.getAllElements()
      const after = mock.getAllElements()
      // Make two random changes
      after[1].annotations.test = true
      after[2].annotations.test = true
      plan = await getPlan({
        before: createElementSource(before),
        after: createElementSource(after),
        customGroupIdFunctions: {
          salto: async changes => new Map([...changes.entries()].map(([changeId]) => [changeId, 'all'])),
          dummy: dummyGroupKeyFunc,
        },
      })
      changeGroup = plan.itemsByEvalOrder()[Symbol.iterator]().next().value
    })

    it('should return only one change group', () => {
      expect(plan.size).toEqual(1)
    })
    it('should return change group with both changes', () => {
      expect(changeGroup).toBeDefined()
      expect([...changeGroup.changes()]).toHaveLength(2)
    })
    it('should not call adapter functions that have no changes', () => {
      expect(dummyGroupKeyFunc).not.toHaveBeenCalled()
    })
  })
})
