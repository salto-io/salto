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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import JiraClient from '../../../src/client/client'
import { GROUP_TYPE_NAME, JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import workflowGroupsFilter from '../../../src/filters/workflow/groups_filter'
import { getFilterParams, mockClient } from '../../utils'

describe('workflowGroupsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let workflowType: ObjectType
  let groupType: ObjectType
  let client: JiraClient
  beforeEach(async () => {
    workflowType = new ObjectType({
      elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME),
    })

    groupType = new ObjectType({
      elemID: new ElemID(JIRA, GROUP_TYPE_NAME),
    })

    const { client: cli, paginator } = mockClient()
    client = cli
    filter = workflowGroupsFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter
  })

  describe('onFetch', () => {
    it('should replace lower cased group name with reference', async () => {
      const group = new InstanceElement('AbC', groupType, {
        name: 'AbC',
      })

      const workflow = new InstanceElement('instance', workflowType, {
        transitions: {
          tran1: {
            name: 'tran1',
            rules: {
              conditions: {
                type: 'UserInGroupCondition',
                configuration: {
                  group: 'abc',
                },
              },
            },
          },
          tran2: {
            name: 'tran2',
            rules: {
              conditions: {
                type: 'UserInAnyGroupCondition',
                configuration: {
                  groups: ['abc'],
                },
              },
            },
          },
        },
      })
      await filter.onFetch([workflow, group])
      expect(workflow.value.transitions.tran1.rules.conditions.configuration.group.elemID).toEqual(
        group.elemID.createNestedID('name'),
      )
      expect(workflow.value.transitions.tran2.rules.conditions.configuration.groups[0].elemID).toEqual(
        group.elemID.createNestedID('name'),
      )
    })

    it('should lower case group name if group instance does not exist', async () => {
      const workflow = new InstanceElement('instance', workflowType, {
        transitions: {
          tran1: {
            name: 'tran1',
            rules: {
              conditions: {
                type: 'UserInGroupCondition',
                configuration: {
                  group: 'ABC',
                },
              },
            },
          },
          tran2: {
            name: 'tran2',
            rules: {
              conditions: {
                type: 'UserInAnyGroupCondition',
                configuration: {
                  groups: ['ABC'],
                },
              },
            },
          },
        },
      })
      await filter.onFetch([workflow])
      expect(workflow.value.transitions.tran1.rules.conditions.configuration.group).toBe('abc')
      expect(workflow.value.transitions.tran2.rules.conditions.configuration.groups[0]).toBe('abc')
    })

    it('Should do nothing if there is no group in configuration', async () => {
      const workflow = new InstanceElement('instance', workflowType, {
        transitions: {
          tran1: {
            name: 'tran1',
            rules: {
              conditions: {
                type: 'UserInGroupCondition',
                configuration: {},
              },
            },
          },
          tran2: {
            name: 'tran2',
            rules: {
              conditions: {
                type: 'UserInAnyGroupCondition',
                configuration: {},
              },
            },
          },
        },
      })
      await filter.onFetch([workflow])
      expect(workflow.value.transitions.tran1.rules.conditions.configuration.group).toBeUndefined()
      expect(workflow.value.transitions.tran2.rules.conditions.configuration.groups).toBeUndefined()
    })
  })
})
