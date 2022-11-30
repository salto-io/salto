/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { InstanceElement, ObjectType, toChange, getAllChangeData, ReferenceExpression, ElemID, isReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../../utils'
import automationStructureFilter from '../../../src/filters/automation/automation_structure'
import { createAutomationTypes } from '../../../src/filters/automation/types'
import { JIRA } from '../../../src/constants'


describe('automationStructureFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let type: ObjectType
  let someType: ObjectType
  let instance: InstanceElement
  let ref: InstanceElement
  let statusim: InstanceElement[]
  let instanceAfterFetch: InstanceElement
  let changedInstance: InstanceElement


  beforeEach(async () => {
    filter = automationStructureFilter(getFilterParams()) as typeof filter

    type = createAutomationTypes().automationType

    instance = new InstanceElement(
      'instance',
      type,
      {
        id: '111',
        trigger: {
          component: 'TRIGGER',
          type: 'jira.issue.event.trigger:created',
        },
        components: [
          {
            id: '0',
            component: 'ACTION',
            value: null,
            updated: 1234,
          },
          {
            id: '1',
            component: 'CONDITION',
            value: 'priority > Medium',
            updated: 1111,
          },
          {
            id: '2',
            component: 'CONDITION',
            value: {
              id: 'someId',
              linkType: 'inward:10003',
              value: '123',
            },
            updated: 1111,
          },
          {
            id: '3',
            component: 'CONDITION',
            value: {
              selectedFieldType: 'priority',
              comparison: 'NOT_ONE_OF',
              compareValue: {
                type: 'ID',
                multiValue: true,
                value: '["\\"123","234","345","a]"]',
              },
            },
          },
          {
            id: '4',
            component: 'CONDITION',
            value: {
              selectedFieldType: 'status',
              comparison: 'EQUALS',
              compareValue: {
                type: 'ID',
                multiValue: false,
                value: 'Done',
              },
            },
          },
          {
            id: '5',
            component: 'ACTION',
            value: {
              operations: [
                {
                  fieldType: 'status',
                  type: 'SET',
                  value: {
                    type: 'NAME',
                    value: 'Done',
                  },
                },
                {
                  fieldType: 'status',
                  type: 'SET',
                  value: 'rawVal',
                },
              ],
            },
          },
          {
            id: '6',
            component: 'CONDITION',
            value: '',
            updated: 1111,
          },
        ],
        projects: [
          {
            projectId: '3',
            projectTypeKey: 'key',
          },
          {
            projectTypeKey: 'key2',
          },
        ],
      }
    )

    someType = new ObjectType({
      elemID: new ElemID(JIRA, 'someType'),
    })

    ref = new InstanceElement(
      'linkInstance',
      someType,
      {
        id: '10003',
        name: 'LinkTypeee',
      }
    )

    statusim = [
      new InstanceElement('s1', someType, { id: '"123', name: 'S1' }),
      new InstanceElement('s1', someType, { id: '234', name: 'S1' }),
      new InstanceElement('s1', someType, { id: '345', name: 'S1' }),
    ]

    instanceAfterFetch = instance.clone()
    instanceAfterFetch.value.components[2].value.linkType = new ReferenceExpression(
      ref.elemID, ref.value.id
    )
    instanceAfterFetch.value.components[2].value.linkTypeDirection = 'inward'
    instanceAfterFetch.value.components[1].rawValue = 'priority > Medium'
    delete instanceAfterFetch.value.components[1].value
    const compareVal1 = instanceAfterFetch.value.components[3].value.compareValue
    instanceAfterFetch.value.components[3].value.compareFieldValue = _.clone(compareVal1)
    delete instanceAfterFetch.value.components[3].value.compareValue
    instanceAfterFetch.value.components[3].value.compareFieldValue.values = [
      new ReferenceExpression(statusim[0].elemID, statusim[0]),
      new ReferenceExpression(statusim[1].elemID, statusim[1]),
      new ReferenceExpression(statusim[2].elemID, statusim[2]),
      'a]',
    ]
    delete instanceAfterFetch.value.components[3].value.compareFieldValue.value
    const compareVal2 = instanceAfterFetch.value.components[4].value.compareValue
    instanceAfterFetch.value.components[4].value.compareFieldValue = _.clone(compareVal2)
    delete instanceAfterFetch.value.components[4].value.compareValue
    instanceAfterFetch.value.components[4].value.compareFieldValue.value = new ReferenceExpression(
      statusim[1].elemID, statusim[1]
    )
    const rawVal = instanceAfterFetch.value.components[5].value.operations[1].value
    instanceAfterFetch.value.components[5].value.operations[1].rawValue = rawVal
    delete instanceAfterFetch.value.components[5].value.operations[1].value

    instanceAfterFetch.value.components[6].rawValue = instanceAfterFetch.value.components[6].value
    delete instanceAfterFetch.value.components[6].value

    changedInstance = instanceAfterFetch.clone()
    changedInstance.value.components[0].component = 'BRANCH'
  })

  describe('onFetch', () => {
    it('should remove null values', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[0].value).toBeUndefined()
    })

    it('should remove inner ids', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[0].id).toBeUndefined()
    })

    it('should not remove inner ids in components values', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[2].value.id).toBe('someId')
    })

    it('should remove redundant keys', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[0].updated).toBeUndefined()
    })

    it('should restructure projects value', async () => {
      await filter.onFetch([instance])
      expect(instance.value.projects).toEqual([
        {
          projectId: '3',
        },
        {
          projectTypeKey: 'key2',
        },
      ])
    })

    it('should change value fields to rawValues only if value is strings', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[1].rawValue).toEqual('priority > Medium')
      expect(instance.value.components[1].value).toBeUndefined()
      expect(instance.value.components[2].rawValue).toBeUndefined()
      expect(instance.value.components[2].value).toBeObject()
      expect(instance.value.components[5].value.operations[1].value).toBeUndefined()
      expect(instance.value.components[5].value.operations[1].rawValue).toEqual('rawVal')
      expect(instance.value.components[6].value).toBeUndefined()
      expect(instance.value.components[6].rawValue).toEqual('')
    })

    it('should should split linkType field', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[2].value.linkType).toEqual('10003')
      expect(instance.value.components[2].value.linkTypeDirection).toEqual('inward')
    })

    it('should restructure compareFieldValue', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[3].value.compareValue).toBeUndefined()
      expect(instance.value.components[3].value.compareFieldValue).toBeObject()
      expect(instance.value.components[3].value.compareFieldValue.values)
        .toEqual(['"123', '234', '345', 'a]'])
      expect(instance.value.components[3].value.compareFieldValue.value).toBeUndefined()
      expect(instance.value.components[4].value.compareValue).toBeUndefined()
      expect(instance.value.components[4].value.compareFieldValue).toBeObject()
      expect(instance.value.components[4].value.compareFieldValue.value).toEqual('Done')
    })
  })

  describe('preDeploy', () => {
    it('should combine linkType fields and change rawValue to value', async () => {
      const changes = [toChange({ before: instanceAfterFetch, after: changedInstance })]
      await filter.preDeploy(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(before.value.components[1].value).toEqual('priority > Medium')
      expect(before.value.components[1].rawValue).toBeUndefined()
      expect(before.value.components[2].value.linkType).toEqual('inward:10003')
      expect(before.value.components[2].value.linkTypeDirection).toBeUndefined()
      expect(after.value.components[1].value).toEqual('priority > Medium')
      expect(after.value.components[1].rawValue).toBeUndefined()
      expect(after.value.components[2].value.linkType).toEqual('inward:10003')
      expect(after.value.components[2].value.linkTypeDirection).toBeUndefined()
      expect(after.value.components[5].value.operations[1].value).toEqual('rawVal')
      expect(after.value.components[5].value.operations[1].rawValue).toBeUndefined()
      expect(after.value.components[6].value).toEqual('')
      expect(after.value.components[6].rawValue).toBeUndefined()
    })
    it('should revert compare value structure to be depolyable', async () => {
      const changes = [toChange({ before: instanceAfterFetch, after: changedInstance })]
      await filter.preDeploy(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(before.value.components[3].value.compareFieldValue).toBeUndefined()
      expect(before.value.components[3].value.compareValue.value).toEqual('["\\"123","234","345","a]"]')
      expect(before.value.components[4].value.compareFieldValue).toBeUndefined()
      expect(before.value.components[4].value.compareValue.value).toEqual('234')
      expect(after.value.components[3].value.compareFieldValue).toBeUndefined()
      expect(after.value.components[3].value.compareValue.value).toEqual('["\\"123","234","345","a]"]')
      expect(after.value.components[4].value.compareFieldValue).toBeUndefined()
      expect(after.value.components[4].value.compareValue.value).toEqual('234')
    })
  })

  describe('onDeplopy', () => {
    it('should split linkType fields and change value to rawValue', async () => {
      const changes = [toChange({ before: instanceAfterFetch, after: changedInstance })]
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(before.value.components[1].value).toBeUndefined()
      expect(before.value.components[1].rawValue).toEqual('priority > Medium')
      expect(before.value.components[2].value.linkType).toBeInstanceOf(ReferenceExpression)
      expect(before.value.components[2].value.linkTypeDirection).toEqual('inward')
      expect(after.value.components[1].value).toBeUndefined()
      expect(after.value.components[1].rawValue).toEqual('priority > Medium')
      expect(after.value.components[2].value.linkType).toBeInstanceOf(ReferenceExpression)
      expect(after.value.components[2].value.linkTypeDirection).toEqual('inward')
      expect(after.value.components[5].value.operations[1].value).toBeUndefined()
      expect(after.value.components[5].value.operations[1].rawValue).toEqual('rawVal')
    })
    it('should change back compareFieldValue', async () => {
      const changes = [toChange({ before: instanceAfterFetch, after: changedInstance })]
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(before.value.components[3].value.compareValue).toBeUndefined()
      expect(before.value.components[3].value.compareFieldValue).toBeObject()
      expect(before.value.components[3].value.compareFieldValue.values
        .filter(isReferenceExpression)).toBeArrayOfSize(3)
      expect(before.value.components[3].value.compareFieldValue.value).toBeUndefined()
      expect(before.value.components[4].value.compareValue).toBeUndefined()
      expect(before.value.components[4].value.compareFieldValue).toBeObject()
      expect(before.value.components[4].value.compareFieldValue.value)
        .toBeInstanceOf(ReferenceExpression)
      expect(after.value.components[3].value.compareValue).toBeUndefined()
      expect(after.value.components[3].value.compareFieldValue).toBeObject()
      expect(
        after.value.components[3].value.compareFieldValue.values
          .filter(isReferenceExpression)
      ).toBeArrayOfSize(3)
      expect(after.value.components[3].value.compareFieldValue.value).toBeUndefined()
      expect(after.value.components[4].value.compareValue).toBeUndefined()
      expect(after.value.components[4].value.compareFieldValue).toBeObject()
      expect(after.value.components[4].value.compareFieldValue.value)
        .toBeInstanceOf(ReferenceExpression)
    })
  })
})
