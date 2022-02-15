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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import JiraClient from '../../../src/client/client'
import { DEFAULT_CONFIG } from '../../../src/config'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import transitionIdsFilter from '../../../src/filters/workflow/transition_ids_filter'
import { mockClient } from '../../utils'

describe('transitionIdsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'onDeploy'>
  let workflowType: ObjectType
  let client: JiraClient
  let mockConnection: MockInterface<clientUtils.APIConnection>
  beforeEach(async () => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })

    const { client: cli, paginator, connection } = mockClient()
    client = cli
    mockConnection = connection

    filter = transitionIdsFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    }) as typeof filter
  })

  describe('onFetch', () => {
    it('should add transitionIds field to the type', async () => {
      await filter.onFetch([workflowType])
      expect(workflowType.fields.transitionIds).toBeDefined()
      expect(workflowType.fields.transitionIds.annotations).toEqual({
        [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      })
    })

    it('should add transitionIds value', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          transitions: [
            { id: '1', name: 'transition1', from: ['4', '5'] },
            { id: '2', name: 'transition2' },
            { id: '3', from: ['6', '7'] },
          ],
        },
      )
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        transitionIds: {
          '4-5-transition1': '1',
          transition2: '2',
          '6-7-': '3',
        },
        transitions: [
          { name: 'transition1', from: ['4', '5'] },
          { name: 'transition2' },
          { from: ['6', '7'] },
        ],
      })
    })

    it('if there are no transitions should do nothing', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          name: 'name',
        },
      )
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        name: 'name',
      })
    })
  })

  describe('onDeploy', () => {
    it('should add transitionIds value', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          name: 'name',
          transitions: [
            { name: 'transition1', from: ['4', '5'] },
            { name: 'transition2' },
            { from: ['6', '7'] },
          ],
        },
      )

      mockConnection.get.mockResolvedValue({
        status: 200,
        data: {
          values: [
            {
              transitions: [
                { id: '1', name: 'transition1', from: ['4', '5'] },
                { id: '2', name: 'transition2' },
                { id: '3', from: ['6', '7'] },
              ],
            },
          ],
        },
      })

      await filter.onDeploy([toChange({ after: instance })])

      expect(mockConnection.get).toHaveBeenCalledWith(
        '/rest/api/3/workflow/search',
        {
          params: {
            expand: 'transitions',
            workflowName: 'name',
          },
        }
      )

      expect(instance.value.transitionIds).toEqual({
        '4-5-transition1': '1',
        transition2: '2',
        '6-7-': '3',
      })
    })

    it('should do nothing when response values is not an array', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          name: 'name',
          transitions: [
            { name: 'transition1', from: ['4', '5'] },
            { name: 'transition2' },
            { from: ['6', '7'] },
          ],
        },
      )

      mockConnection.get.mockResolvedValue({
        status: 200,
        data: {
          values: {},
        },
      })

      await filter.onDeploy([toChange({ after: instance })])

      expect(instance.value.transitionIds).toEqual({})
    })

    it('should do nothing when number of workflows in response is invalid', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          name: 'name',
          transitions: [
            { name: 'transition1', from: ['4', '5'] },
            { name: 'transition2' },
            { from: ['6', '7'] },
          ],
        },
      )

      mockConnection.get.mockResolvedValue({
        status: 200,
        data: {
          values: [],
        },
      })

      await filter.onDeploy([toChange({ after: instance })])

      expect(instance.value.transitionIds).toEqual({})
    })

    it('should do nothing when workflow in response is invalid', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          name: 'name',
          transitions: [
            { name: 'transition1', from: ['4', '5'] },
            { name: 'transition2' },
            { from: ['6', '7'] },
          ],
        },
      )

      mockConnection.get.mockResolvedValue({
        status: 200,
        data: {
          values: [{
            transitions: 2,
          }],
        },
      })

      await filter.onDeploy([toChange({ after: instance })])

      expect(instance.value.transitionIds).toEqual({})
    })

    it('should do nothing when there are not transitions in response', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          name: 'name',
        },
      )

      mockConnection.get.mockResolvedValue({
        status: 200,
        data: {
          values: [{
          }],
        },
      })

      await filter.onDeploy([toChange({ after: instance })])

      expect(instance.value.transitionIds).toEqual({})
    })
  })
})
