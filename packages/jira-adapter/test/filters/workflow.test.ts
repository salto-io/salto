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
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { deployment, filterUtils } from '@salto-io/adapter-components'
import JiraClient from '../../src/client/client'
import { DEFAULT_CONFIG } from '../../src/config'
import { JIRA } from '../../src/constants'
import workflowFilter, { INITIAL_VALIDATOR } from '../../src/filters/workflow/workflow'
import { mockClient } from '../utils'
import { EXPECTED_POST_FUNCTIONS, WITH_PERMISSION_VALIDATORS, WITH_POST_FUNCTIONS, WITH_SCRIPT_RUNNERS, WITH_UNSUPPORTED_POST_FUNCTIONS, WITH_VALIDATORS } from './workflow_values'

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

describe('workflowFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let workflowType: ObjectType
  let client: JiraClient
  beforeEach(async () => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, 'Workflow') })

    const { client: cli, paginator } = mockClient()
    client = cli
    filter = workflowFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    }) as typeof filter
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

    it('should replace postFunctions and validators types and and return the new types', async () => {
      const workflowRulesType = new ObjectType({
        elemID: new ElemID(JIRA, 'WorkflowRules'),
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

  describe('deploy', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<
      typeof deployment.deployChange
    >

    beforeEach(() => {
      deployChangeMock.mockClear()
    })
    it('should remove the last PermissionValidator with permissionKey CREATE_ISSUES', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          WITH_PERMISSION_VALIDATORS
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              transitions: [
                {
                  type: 'initial',
                  rules: {
                    validators: [
                      INITIAL_VALIDATOR,
                      {
                        type: 'PreviousStatusValidator',
                        configuration: {
                          previousStatus: {
                            id: '1',
                            name: 'name',
                          },
                        },
                      },
                      {
                        type: 'PermissionValidator',
                        configuration: {
                          permissionKey: 'OTHER',
                        },
                      },
                    ],
                  },
                },
              ],
            }
          ),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.Workflow.deployRequests,
        [],
        undefined
      )
    })

    it('should remove the undeployable post functions and validators', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          WITH_SCRIPT_RUNNERS
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              transitions: [
                {
                  rules: {
                    validators: [
                      {
                        type: 'other',
                      },
                      {
                        val: 'val',
                      },
                    ],
                    postFunctions: [
                      {
                        type: 'other',
                      },
                      {
                        val: 'val',
                      },
                    ],
                  },
                },
              ],
            }
          ),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.Workflow.deployRequests,
        [],
        undefined
      )
    })

    it('should not change the values if there are no transitions', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          {}
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {},
          ),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.Workflow.deployRequests,
        [],
        undefined
      )
    })

    it('should not change the values if there are no rules', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          {
            transitions: [
              {
                type: 'initial',
              },
            ],
          }
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              transitions: [
                {
                  type: 'initial',
                },
              ],
            },
          ),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.Workflow.deployRequests,
        [],
        undefined
      )
    })

    it('should not change the values if values are not a valid workflow', async () => {
      const change = toChange({
        after: new InstanceElement(
          'instance',
          workflowType,
          {
            transitions: 2,
          }
        ),
      })

      await filter.deploy([change])

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement(
            'instance',
            workflowType,
            {
              transitions: 2,
            },
          ),
        }),
        client,
        DEFAULT_CONFIG.apiDefinitions.types.Workflow.deployRequests,
        [],
        undefined
      )
    })
  })
})
