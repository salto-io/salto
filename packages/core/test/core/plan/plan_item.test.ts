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
import wu from 'wu'
import _ from 'lodash'
import { Group } from '@salto-io/dag'
import { isListType, Change, ChangeDataType } from '@salto-io/adapter-api'
import * as mock from '../../common/elements'
import { getFirstPlanItem, toChange } from '../../common/plan'
import { planGenerators } from './plan.test'
import { PlanItem } from '../../../src/core/plan'
import { addPlanItemAccessors } from '../../../src/core/plan/plan_item'

describe('PlanItem', () => {
  const allElements = mock.getAllElements()

  const {
    planWithTypeChanges,
    planWithFieldChanges,
    planWithNewType,
    planWithInstanceChange,
    planWithListChange,
    planWithAnnotationTypesChanges,
    planWithFieldIsListChanges,
  } = planGenerators(allElements)

  describe('action property', () => {
    const toChangeGroup = (
      groupKey: string, changes: ReadonlyArray<Change>,
    ): Group<Change<ChangeDataType>> => ({
      groupKey,
      items: new Map(changes.map(change => [_.uniqueId(), change])),
    })
    describe('when all changes are add or remove', () => {
      let addItem: PlanItem
      let removeItem: PlanItem
      beforeEach(() => {
        addItem = addPlanItemAccessors(toChangeGroup(
          'additions',
          [toChange({ after: allElements[0] }), toChange({ after: allElements[1] })],
        ))
        removeItem = addPlanItemAccessors(toChangeGroup(
          'removals',
          [toChange({ before: allElements[0] }), toChange({ before: allElements[1] })],
        ))
      })
      it('should match the change type', () => {
        expect(addItem.action).toEqual('add')
        expect(removeItem.action).toEqual('remove')
      })
    })
    describe('when there are no top level changes in a group', () => {
      let item: PlanItem
      beforeEach(() => {
        item = addPlanItemAccessors(toChangeGroup(
          'fieldChanges',
          Object.values(allElements[1].fields).map(field => toChange({ after: field }))
        ))
      })
      it('should have a modify action', () => {
        expect(item.action).toEqual('modify')
      })
    })
    describe('when there is a mix of different actions in the group', () => {
      let item: PlanItem
      beforeEach(() => {
        item = addPlanItemAccessors(toChangeGroup(
          'mixed',
          [toChange({ before: allElements[0] }), toChange({ after: allElements[1] })]
        ))
      })
      it('should have a modify action', () => {
        expect(item.action).toEqual('modify')
      })
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

    it('should return list of annotationType changes in case of annotationType change', async () => {
      const [plan, obj] = await planWithAnnotationTypesChanges()
      const planItem = getFirstPlanItem(plan)
      const changes = [...planItem.detailedChanges()]
      expect(changes).toHaveLength(1)
      const [annoChange] = changes
      expect(annoChange.action).toEqual('add')
      expect(annoChange.id).toEqual(obj.elemID.createNestedID('annotation', 'new'))
    })

    it('should return is list value modification when a field is changed to list', async () => {
      const [plan, changedElem] = await planWithFieldIsListChanges()
      const planItem = getFirstPlanItem(plan)
      const changes = wu(planItem.detailedChanges()).toArray()
      expect(changes).toHaveLength(2)
      const [toListChange, fromListChange] = changes
      expect(toListChange.action).toEqual('modify')
      expect(toListChange.id).toEqual(changedElem.fields.name.elemID)
      expect(isListType(_.get(toListChange.data, 'after').type)).toBeTruthy()
      expect(fromListChange.action).toEqual('modify')
      expect(fromListChange.id).toEqual(changedElem.fields.rooms.elemID)
      expect(isListType(_.get(fromListChange.data, 'after').type)).toBeFalsy()
    })
  })
})
