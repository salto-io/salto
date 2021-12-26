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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../src/constants'
import workflowFilter from '../../src/filters/workflow/workflow'
import { mockClient, getDefaultAdapterConfig } from '../utils'

describe('workflowFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let workflowType: ObjectType
  beforeEach(async () => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, 'Workflow') })

    const { client, paginator } = mockClient()
    filter = workflowFilter({
      client,
      paginator,
      config: await getDefaultAdapterConfig(),
    }) as typeof filter
  })

  it('should split the id field to entityId and name in Workflow type', async () => {
    const workflowIdType = new ObjectType({
      elemID: new ElemID(JIRA, 'WorkflowId'),
      fields: {
        entityId: {
          refType: BuiltinTypes.STRING,
        },
        name: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    workflowType.fields.name = new Field(workflowType, 'id', workflowIdType)
    await filter.onFetch([workflowType])
    expect(workflowType.fields.id).toBeUndefined()
    expect(workflowType.fields.entityId.annotations)
      .toEqual({ [CORE_ANNOTATIONS.HIDDEN_VALUE]: true })
    expect(workflowType.fields.name).toBeDefined()
  })

  it('should set the properties field in WorkflowStatus', async () => {
    const workflowStatusType = new ObjectType({
      elemID: new ElemID(JIRA, 'WorkflowStatus'),
    })
    await filter.onFetch([workflowStatusType])
    expect(workflowStatusType.fields.properties).toBeDefined()
  })

  it('should replace conditionsTree with conditions in WorkflowRules', async () => {
    const workflowRulesType = new ObjectType({
      elemID: new ElemID(JIRA, 'WorkflowRules'),
      fields: {
        conditionsTree: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    await filter.onFetch([workflowRulesType])
    expect(workflowRulesType.fields.conditionsTree).toBeUndefined()
    expect(workflowRulesType.fields.conditions).toBeDefined()
  })

  it('should replace postFunctionTypes and return the new types', async () => {
    const workflowRulesType = new ObjectType({
      elemID: new ElemID(JIRA, 'WorkflowRules'),
      fields: {
        conditionsTree: {
          refType: BuiltinTypes.STRING,
        },
        postFunctions: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    const elements = [workflowRulesType]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(7)
    expect((await workflowRulesType.fields.postFunctions.getType()).elemID.getFullName()).toBe('List<jira.PostFunction>')
  })

  it('should split the id value to entityId and name in Workflow instances', async () => {
    const instance = new InstanceElement(
      'instance',
      workflowType,
      {
        id: {
          entityId: 'id',
          name: 'name',
        },
      }
    )
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      entityId: 'id',
      name: 'name',
    })
  })

  it('should remove additionalProperties and issueEditable from statuses', async () => {
    const instance = new InstanceElement(
      'instance',
      workflowType,
      {
        statuses: [
          {
            properties: {
              additionalProperties: {
                'jira.issue.editable': 'true',
                issueEditable: true,
              },
            },
          },
          {
            properties: {
              additionalProperties: {
                'jira.issue.editable': 'false',
                issueEditable: false,
              },
            },
          },
          {},
        ],
      }
    )
    await filter.onFetch([instance])
    expect(instance.value.statuses).toEqual([
      {
        properties: {
          'jira.issue.editable': 'true',
        },
      },
      {
        properties: {
          'jira.issue.editable': 'false',
        },
      },
      {},
    ])
  })

  it('should replace conditionsTree with conditions', async () => {
    const instance = new InstanceElement(
      'instance',
      workflowType,
      {
        transitions: [
          {
            rules: {
              conditionsTree: 'conditionsTree',
            },
          },
        ],
      }
    )
    await filter.onFetch([instance])
    expect(instance.value.transitions).toEqual([
      {
        rules: {
          conditions: 'conditionsTree',
        },
      },
    ])
  })

  it('should remove name from post functions', async () => {
    const instance = new InstanceElement(
      'instance',
      workflowType,
      {
        transitions: [
          {
            rules: {
              postFunctions: [
                {
                  type: 'FireIssueEventFunction',
                  configuration: {
                    event: {
                      id: '1',
                      name: 'name',
                    },
                  },
                },
                {
                  type: 'FireIssueEventFunction',
                  configuration: {
                  },
                },
                {
                  type: 'FireIssueEventFunction',
                },
                {
                  type: 'SetIssueSecurityFromRoleFunction',
                  configuration: {
                    projectRole: {
                      id: '1',
                      name: 'name',
                    },
                  },
                },
                {
                  type: 'SetIssueSecurityFromRoleFunction',
                  configuration: {
                  },
                },
                {
                  type: 'SetIssueSecurityFromRoleFunction',
                },
              ],
            },
          },
        ],
      }
    )
    await filter.onFetch([instance])
    expect(instance.value.transitions).toEqual([
      {
        rules: {
          postFunctions: [
            {
              type: 'FireIssueEventFunction',
              configuration: {
                event: {
                  id: '1',
                },
              },
            },
            {
              type: 'FireIssueEventFunction',
              configuration: {},
            },
            {
              type: 'FireIssueEventFunction',
            },

            {
              type: 'SetIssueSecurityFromRoleFunction',
              configuration: {
                projectRole: {
                  id: '1',
                },
              },
            },
            {
              type: 'SetIssueSecurityFromRoleFunction',
              configuration: {
              },
            },
            {
              type: 'SetIssueSecurityFromRoleFunction',
            },
          ],
        },
      },
    ])
  })

  it('should remove unsupported post functions', async () => {
    const instance = new InstanceElement(
      'instance',
      workflowType,
      {
        transitions: [
          {
            type: 'initial',
            rules: {
              postFunctions: [
                { type: 'AssignToCurrentUserFunction' },
                { type: 'UpdateIssueStatusFunction' },
                { type: 'unsupported' },
              ],
            },
          },
          {
            type: 'global',
            rules: {
              postFunctions: [
                { type: 'AssignToCurrentUserFunction' },
                { type: 'UpdateIssueStatusFunction' },
                { type: 'unsupported' },
              ],
            },
          },
        ],
      }
    )
    await filter.onFetch([instance])
    expect(instance.value.transitions).toEqual([
      {
        type: 'initial',
        rules: {
          postFunctions: [
            { type: 'AssignToCurrentUserFunction' },
            { type: 'UpdateIssueStatusFunction' },
          ],
        },
      },
      {
        type: 'global',
        rules: {
          postFunctions: [
            { type: 'AssignToCurrentUserFunction' },
          ],
        },
      },
    ])
  })
})
