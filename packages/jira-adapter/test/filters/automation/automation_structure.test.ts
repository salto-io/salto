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
import { InstanceElement, ObjectType, toChange, getAllChangeData, ReferenceExpression, ElemID } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { mockClient } from '../../utils'
import automationStructureFilter from '../../../src/filters/automation/automation_structure'
import { getDefaultConfig } from '../../../src/config/config'
import { createAutomationTypes } from '../../../src/filters/automation/types'
import { JIRA } from '../../../src/constants'


describe('automationStructureFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let type: ObjectType
  let instance: InstanceElement
  let ref: InstanceElement
  let instanceAfterFetch: InstanceElement
  let changedInstance: InstanceElement


  beforeEach(async () => {
    const { client, paginator } = mockClient()

    filter = automationStructureFilter({
      client,
      paginator,
      config: getDefaultConfig({ isDataCenter: false }),
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as typeof filter

    type = createAutomationTypes().automationType

    instance = new InstanceElement(
      'instance',
      type,
      {
        id: '1',
        trigger: {
          component: 'TRIGGER',
          type: 'jira.issue.event.trigger:created',
        },
        components: [
          {
            id: '2',
            component: 'ACTION',
            value: null,
            updated: 1234,
          },
          {
            id: '3',
            component: 'CONDITION',
            value: 'priority > Medium',
            updated: 1111,
          },
          {
            id: '4',
            component: 'CONDITION',
            value: {
              linkType: 'inward:10003',
              value: '123',
            },
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

    ref = new InstanceElement(
      'linkInstance',
      new ObjectType({
        elemID: new ElemID(JIRA, 'someType'),
      }),
      {
        id: '10003',
        name: 'LinkTypeee',
      }
    )

    instanceAfterFetch = instance.clone()
    instanceAfterFetch.value.components[2].value.linkType = new ReferenceExpression(
      ref.elemID, ref.value.id
    )
    instanceAfterFetch.value.components[2].value.linkTypeDirection = 'inward'
    instanceAfterFetch.value.components[1].rawValue = 'priority > Medium'
    delete instanceAfterFetch.value.components[1].value
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
    })

    it('should should split linkType field', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[2].value.linkType).toEqual('10003')
      expect(instance.value.components[2].value.linkTypeDirection).toEqual('inward')
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
    })
  })
})
