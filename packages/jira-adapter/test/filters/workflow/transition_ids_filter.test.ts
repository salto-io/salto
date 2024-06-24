/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import JiraClient from '../../../src/client/client'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import transitionIdsFilter from '../../../src/filters/workflow/transition_ids_filter'
import { getFilterParams, mockClient } from '../../utils'

describe('transitionIdsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'onDeploy'>
  let workflowType: ObjectType
  let client: JiraClient
  beforeEach(async () => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })

    const { client: cli, paginator } = mockClient()
    client = cli

    filter = transitionIdsFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter
  })

  describe('onFetch', () => {
    it('should remove transition ids', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        transitions: {
          tran1: { id: '1', name: 'transition1', from: ['4', '5'] },
          tran2: { id: '2', name: 'transition2' },
          tran3: { name: 'tran3', id: '3', from: ['7', '6'] },
        },
      })
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        transitions: {
          tran1: { name: 'transition1', from: ['4', '5'] },
          tran2: { name: 'transition2' },
          tran3: { name: 'tran3', from: ['7', '6'] },
        },
      })
    })

    it('should do nothing if there are no transitions', async () => {
      const instance = new InstanceElement('instance', workflowType, {})
      await filter.onFetch([instance])
      expect(instance.value).toEqual({})
    })
  })
  describe('onDeploy', () => {
    it('should add transition ids', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        transitions: {
          tran1: { id: '1', name: 'transition1', from: ['4', '5'] },
          tran2: { id: '2', name: 'transition2' },
          tran3: { name: 'tran3', id: '3', from: ['7', '6'] },
        },
      })
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value).toEqual({
        transitions: {
          tran1: { name: 'transition1', from: ['4', '5'] },
          tran2: { name: 'transition2' },
          tran3: { name: 'tran3', from: ['7', '6'] },
        },
      })
    })
  })
})
