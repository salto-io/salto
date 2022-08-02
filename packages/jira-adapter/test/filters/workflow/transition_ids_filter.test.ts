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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import JiraClient from '../../../src/client/client'
import { getDefaultConfig } from '../../../src/config'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import transitionIdsFilter from '../../../src/filters/workflow/transition_ids_filter'
import { mockClient } from '../../utils'

describe('transitionIdsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'onDeploy'>
  let workflowType: ObjectType
  let client: JiraClient
  beforeEach(async () => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })

    const { client: cli, paginator } = mockClient()
    client = cli

    filter = transitionIdsFilter({
      client,
      paginator,
      config: getDefaultConfig({ isDataCenter: false }),
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
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
            { id: '3', from: ['7', '6'] },
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
          { from: ['7', '6'] },
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
})
