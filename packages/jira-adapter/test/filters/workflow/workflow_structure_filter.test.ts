/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import JiraClient from '../../../src/client/client'
import { JIRA, WORKFLOW_RULES_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import workflowFilter from '../../../src/filters/workflow/workflow_structure_filter'
import { getFilterParams, mockClient } from '../../utils'
import { EXPECTED_POST_FUNCTIONS, WITH_POST_FUNCTIONS, WITH_UNSUPPORTED_POST_FUNCTIONS, WITH_VALIDATORS } from './workflow_values'

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn(),
    },
  }
})

describe('workflowStructureFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let workflowType: ObjectType
  let client: JiraClient
  beforeEach(async () => {
    workflowType = new ObjectType({
      elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME),
      fields: {
        operations: { refType: BuiltinTypes.STRING },
      },
    })

    const { client: cli, paginator } = mockClient()
    client = cli
    filter = workflowFilter(getFilterParams({
      client,
      paginator,
    })) as typeof filter
  })

  describe('onFetch', () => {
    it('should delete the id field in Workflow type', async () => {
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
      workflowType.fields.id = new Field(workflowType, 'id', workflowIdType)
      await filter.onFetch([workflowType])
      expect(workflowType.fields.id).toBeUndefined()
    })

    it('should set the properties field in WorkflowStatus', async () => {
      const workflowStatusType = new ObjectType({
        elemID: new ElemID(JIRA, 'WorkflowStatus'),
        fields: {
          name: { refType: BuiltinTypes.STRING },
        },
      })
      await filter.onFetch([workflowStatusType])
      expect(workflowStatusType.fields.properties).toBeDefined()
    })

    it('should replace conditionsTree with conditions in WorkflowRules', async () => {
      const workflowRulesType = new ObjectType({
        elemID: new ElemID(JIRA, WORKFLOW_RULES_TYPE_NAME),
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

    it('should replace postFunctions and validators types and and return the new types', async () => {
      const workflowRulesType = new ObjectType({
        elemID: new ElemID(JIRA, WORKFLOW_RULES_TYPE_NAME),
        fields: {
          conditionsTree: {
            refType: BuiltinTypes.STRING,
          },
          postFunctions: {
            refType: BuiltinTypes.STRING,
          },
          validators: {
            refType: BuiltinTypes.STRING,
          },
        },
      })
      const elements = [workflowRulesType]
      await filter.onFetch(elements)
      expect(elements.length).toBeGreaterThan(1)
      expect((await workflowRulesType.fields.postFunctions.getType()).elemID.getFullName()).toBe('List<jira.PostFunction>')
      expect((await workflowRulesType.fields.validators.getType()).elemID.getFullName()).toBe('List<jira.Validator>')
    })

    it('should replace conditions configuration types and and return the new types', async () => {
      const workflowConditionType = new ObjectType({
        elemID: new ElemID(JIRA, 'WorkflowCondition'),
        fields: {
          configuration: {
            refType: BuiltinTypes.STRING,
          },
        },
      })
      const elements = [workflowConditionType]
      await filter.onFetch(elements)
      expect(elements.length).toBeGreaterThan(1)
      expect((await workflowConditionType.fields.configuration.getType()).elemID.getFullName()).toBe('jira.ConditionConfiguration')
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
          transitions: [],
        }
      )
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        entityId: 'id',
        name: 'name',
        transitions: [],
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
          transitions: [],
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

    it('should remove additionalProperties and issueEditable from transitions', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          transitions: [
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
      expect(instance.value.transitions).toEqual([
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
                conditionsTree: { type: 'type' },
              },
            },
          ],
        }
      )
      await filter.onFetch([instance])
      expect(instance.value.transitions).toEqual([
        {
          rules: {
            conditions: { type: 'type' },
          },
        },
      ])
    })

    it('should remove id if condition type is an extension', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          transitions: [
            {
              rules: {
                conditionsTree: {
                  type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
                  configuration: {
                    id: 'id',
                  },
                  conditions: [{
                    type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesCondition',
                    configuration: {
                      id: 'id',
                    },
                  }],
                },
              },
            },
          ],
        }
      )
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        transitions: [
          {
            rules: {
              conditions: {
                type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
                configuration: {
                },
                conditions: [{
                  type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesCondition',
                  configuration: {
                  },
                }],
              },
            },
          },
        ],
      })
    })

    it('should remove name values from condition configuration', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          transitions: [
            {
              rules: {
                conditionsTree: {
                  type: 'type',
                  configuration: {
                    name: 'name',
                    other: 'other',
                  },
                  conditions: [{
                    type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesCondition',
                    configuration: {
                      vals: [{
                        name: 'name',
                      }],
                    },
                  }],
                },
              },
            },
          ],
        }
      )
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        transitions: [
          {
            rules: {
              conditions: {
                type: 'type',
                configuration: {
                  other: 'other',
                },
                conditions: [{
                  type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesCondition',
                  configuration: {
                    vals: [{
                    }],
                  },
                }],
              },
            },
          },
        ],
      })
    })

    it('should do nothing if there is no configuration in an extension type', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          transitions: [
            {
              rules: {
                conditionsTree: {
                  type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
                },
              },
            },
          ],
        }
      )
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        transitions: [
          {
            rules: {
              conditions: {
                type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
              },
            },
          },
        ],
      })
    })

    describe('post functions', () => {
      it('should remove name from post functions', async () => {
        const instance = new InstanceElement(
          'instance',
          workflowType,
          WITH_POST_FUNCTIONS
        )
        await filter.onFetch([instance])
        expect(instance.value.transitions).toEqual([
          EXPECTED_POST_FUNCTIONS,
        ])
      })

      it('should remove id from post functions with an extension type', async () => {
        const instance = new InstanceElement(
          'instance',
          workflowType,
          {
            transitions: [
              {
                rules: {
                  postFunctions: [
                    {
                      type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
                      configuration: {
                        id: '1',
                      },
                    },
                  ],
                },
              },
            ],
          }
        )
        await filter.onFetch([instance])
        expect(instance.value).toEqual({
          transitions: [
            {
              rules: {
                postFunctions: [
                  {
                    type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
                    configuration: {
                    },
                  },
                ],
              },
            },
          ],
        })
      })

      it('should do nothing if there is no config in an extension type', async () => {
        const instance = new InstanceElement(
          'instance',
          workflowType,
          {
            transitions: [
              {
                rules: {
                  postFunctions: [
                    {
                      type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
                    },
                  ],
                },
              },
            ],
          }
        )
        await filter.onFetch([instance])
        expect(instance.value).toEqual({
          transitions: [
            {
              rules: {
                postFunctions: [
                  {
                    type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
                  },
                ],
              },
            },
          ],
        })
      })

      it('should remove unsupported post functions', async () => {
        const instance = new InstanceElement(
          'instance',
          workflowType,
          WITH_UNSUPPORTED_POST_FUNCTIONS
        )
        await filter.onFetch([instance])
        expect(instance.value.transitions).toEqual([
          {
            type: 'initial',
            rules: {
              postFunctions: [
                { type: 'AssignToCurrentUserFunction' },
                { type: 'UpdateIssueStatusFunction' },
                {},
              ],
            },
          },
          {
            type: 'global',
            rules: {
              postFunctions: [
                { type: 'AssignToCurrentUserFunction' },
                {},
              ],
            },
          },
        ])
      })
    })

    describe('validators', () => {
      it('should remove name', async () => {
        const instance = new InstanceElement(
          'instance',
          workflowType,
          WITH_VALIDATORS,
        )
        await filter.onFetch([instance])
        expect(instance.value.transitions).toEqual([
          {
            rules: {
              validators: [
                {
                  type: 'ParentStatusValidator',
                  configuration: {
                    parentStatuses: [{
                      id: '1',
                    }],
                  },
                },
                {
                  type: 'PreviousStatusValidator',
                  configuration: {
                    previousStatus: {
                      id: '1',
                    },
                  },
                },
                {
                  type: 'PreviousStatusValidator',
                },
              ],
            },
          },
        ])
      })

      it('should remove id from validators with an extension type', async () => {
        const instance = new InstanceElement(
          'instance',
          workflowType,
          {
            transitions: [
              {
                rules: {
                  validators: [
                    {
                      type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
                      configuration: {
                        id: '1',
                      },
                    },
                  ],
                },
              },
            ],
          }
        )
        await filter.onFetch([instance])
        expect(instance.value).toEqual({
          transitions: [
            {
              rules: {
                validators: [
                  {
                    type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
                    configuration: {
                    },
                  },
                ],
              },
            },
          ],
        })
      })

      it('should rename fields to fieldIds', async () => {
        const instance = new InstanceElement(
          'instance',
          workflowType,
          {
            transitions: [
              {
                rules: {
                  validators: [
                    {
                      type: 'ParentStatusValidator',
                      configuration: {
                        fields: ['1'],
                        field: '1',
                      },
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
              validators: [
                {
                  type: 'ParentStatusValidator',
                  configuration: {
                    fieldIds: ['1'],
                    fieldId: '1',
                  },
                },
              ],
            },
          },
        ])
      })

      it('should convert windowsDays to number', async () => {
        const instance = new InstanceElement(
          'instance',
          workflowType,
          {
            transitions: [
              {
                rules: {
                  validators: [
                    {
                      type: 'ParentStatusValidator',
                      configuration: {
                        windowsDays: '1',
                      },
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
              validators: [
                {
                  type: 'ParentStatusValidator',
                  configuration: {
                    windowsDays: 1,
                  },
                },
              ],
            },
          },
        ])
      })
    })

    it('should not convert invalid workflow', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          transitions: [
            {
              rules: {
                postFunctions: 'invalid',
                validators: [
                  {
                    type: 'ParentStatusValidator',
                    configuration: {
                      windowsDays: '1',
                    },
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
            postFunctions: 'invalid',
            validators: [
              {
                type: 'ParentStatusValidator',
                configuration: {
                  windowsDays: '1',
                },
              },
            ],
          },
        },
      ])
    })
  })
})
