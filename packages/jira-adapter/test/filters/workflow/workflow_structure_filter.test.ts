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
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  Field,
  InstanceElement,
  MapType,
  ObjectType,
} from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import JiraClient from '../../../src/client/client'
import {
  JIRA,
  WORKFLOW_RULES_TYPE_NAME,
  WORKFLOW_TRANSITION_TYPE_NAME,
  WORKFLOW_TYPE_NAME,
} from '../../../src/constants'
import workflowFilter from '../../../src/filters/workflow/workflow_structure_filter'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { WITH_UNSUPPORTED_POST_FUNCTIONS, WITH_VALIDATORS } from './workflow_values'
import { Transition } from '../../../src/filters/workflow/types'
import { Filter } from '../../../src/filter'

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

const transitionKeyMap = {
  tran1: naclCase('tran1::From: any status::Circular'),
  tran2: naclCase('tran2::From: any status::Circular'),
  tran3: naclCase('tran3::From: any status::Circular'),
  tran1Initial: naclCase('tran1::From: none::Initial'),
}

const createEmptyTransition = (tranNum: string): Transition => ({
  name: `tran${tranNum}`,
  rules: {},
})

describe('workflowStructureFilter', () => {
  let filter: Filter
  let workflowType: ObjectType
  let transitionType: ObjectType
  let client: JiraClient
  beforeEach(async () => {
    workflowType = new ObjectType({
      elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME),
      fields: {
        operations: { refType: BuiltinTypes.STRING },
        transitions: { refType: new MapType(BuiltinTypes.STRING) },
      },
    })
    transitionType = createEmptyType(WORKFLOW_TRANSITION_TYPE_NAME)

    const { client: cli, paginator } = mockClient()
    client = cli
    filter = workflowFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter
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
      await filter.onFetch?.([workflowType])
      expect(workflowType.fields.id).toBeUndefined()
    })

    it('should set the properties field in WorkflowStatus', async () => {
      const workflowStatusType = new ObjectType({
        elemID: new ElemID(JIRA, 'WorkflowStatus'),
        fields: {
          name: { refType: BuiltinTypes.STRING },
        },
      })
      await filter.onFetch?.([workflowStatusType])
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
      await filter.onFetch?.([workflowRulesType])
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
      await filter.onFetch?.(elements)
      expect(elements.length).toBeGreaterThan(1)
      expect((await workflowRulesType.fields.postFunctions.getType()).elemID.getFullName()).toBe(
        'List<jira.PostFunction>',
      )
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
      await filter.onFetch?.(elements)
      expect(elements.length).toBeGreaterThan(1)
      expect((await workflowConditionType.fields.configuration.getType()).elemID.getFullName()).toBe(
        'jira.ConditionConfiguration',
      )
      expect(workflowConditionType.fields.configuration.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })
    it('should convert transitions type to a map', async () => {
      await filter.onFetch?.([transitionType, workflowType])
      expect((await workflowType.fields.transitions.getType()).elemID.getFullName()).toBe('Map<jira.Transition>')
    })

    it('should split the id value to entityId and name in Workflow instances', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        id: {
          entityId: 'id',
          name: 'name',
        },
        transitions: [],
      })
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        entityId: 'id',
        name: 'name',
        transitions: {},
      })
    })

    it('should remove additionalProperties and issueEditable from statuses', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        statuses: [
          {
            properties: {
              'jira.issue.editable': 'true',
              issueEditable: true,
            },
          },
          {
            properties: {
              'jira.issue.editable': 'false',
              issueEditable: false,
            },
          },
          {},
        ],
        transitions: [],
      })
      await filter.onFetch?.([instance])
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
      const instance = new InstanceElement('instance', workflowType, {
        transitions: [
          {
            name: 'tran1',
            properties: {
              'jira.issue.editable': 'true',
              issueEditable: true,
            },
          },
          {
            name: 'tran2',
            properties: {
              'jira.issue.editable': 'false',
              issueEditable: false,
            },
          },
          { name: 'tran3' },
        ],
      })
      await filter.onFetch?.([instance])
      expect(instance.value.transitions[transitionKeyMap.tran1].properties).toEqual({
        'jira.issue.editable': 'true',
      })
      expect(instance.value.transitions[transitionKeyMap.tran2].properties).toEqual({
        'jira.issue.editable': 'false',
      })
    })

    it('should replace conditionsTree with conditions', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        transitions: [
          {
            name: 'tran1',
            rules: {
              conditionsTree: { type: 'type' },
            },
          },
        ],
      })
      await filter.onFetch?.([instance])
      expect(instance.value.transitions[transitionKeyMap.tran1].rules).toEqual({
        conditions: { type: 'type' },
      })
    })

    it('should remove id if condition type is an extension', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        transitions: [
          {
            name: 'tran1',
            rules: {
              conditionsTree: {
                type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
                configuration: {
                  id: 'id',
                },
                conditions: [
                  {
                    type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesCondition',
                    configuration: {
                      id: 'id',
                    },
                  },
                ],
              },
            },
          },
        ],
      })
      await filter.onFetch?.([instance])
      expect(instance.value.transitions[transitionKeyMap.tran1].rules).toEqual({
        conditions: {
          type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
          configuration: {},
          conditions: [
            {
              type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesCondition',
              configuration: {},
            },
          ],
        },
      })
    })

    it('should remove name values from condition configuration', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        transitions: [
          {
            name: 'tran1',
            rules: {
              conditionsTree: {
                type: 'type',
                configuration: {
                  name: 'name',
                  other: 'other',
                },
                conditions: [
                  {
                    type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesCondition',
                    configuration: {
                      vals: [
                        {
                          name: 'name',
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      })
      await filter.onFetch?.([instance])
      expect(instance.value.transitions[transitionKeyMap.tran1].rules).toEqual({
        conditions: {
          type: 'type',
          configuration: {
            other: 'other',
          },
          conditions: [
            {
              type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesCondition',
              configuration: {
                vals: [{}],
              },
            },
          ],
        },
      })
    })

    it('should do nothing if there is no configuration in an extension type', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        transitions: [
          {
            name: 'tran1',
            rules: {
              conditionsTree: {
                type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
              },
            },
          },
        ],
      })
      await filter.onFetch?.([instance])
      expect(instance.value.transitions[transitionKeyMap.tran1].rules).toEqual({
        conditions: {
          type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
        },
      })
    })

    describe('post functions', () => {
      it('should remove name from post functions', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [
            {
              name: 'tran1',
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
                        name: 'name',
                      },
                    },
                  },
                  {
                    type: 'SetIssueSecurityFromRoleFunction',
                    configuration: {},
                  },
                  {
                    type: 'SetIssueSecurityFromRoleFunction',
                  },
                ],
              },
            },
          ],
        })
        await filter.onFetch?.([instance])
        expect(instance.value.transitions[transitionKeyMap.tran1].rules).toEqual({
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
              configuration: {},
            },
            {
              type: 'SetIssueSecurityFromRoleFunction',
            },
          ],
        })
      })

      it('should remove id from post functions with an extension type', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [
            {
              name: 'tran1',
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
        })
        await filter.onFetch?.([instance])
        expect(instance.value.transitions[transitionKeyMap.tran1].rules).toEqual({
          postFunctions: [
            {
              type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
              configuration: {},
            },
          ],
        })
      })

      it('should do nothing if there is no config in an extension type', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [
            {
              name: 'tran1',
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
        await filter.onFetch?.([instance])
        expect(instance.value.transitions[transitionKeyMap.tran1].rules).toEqual({
          postFunctions: [
            {
              type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
            },
          ],
        })
      })

      it('should remove unsupported post functions', async () => {
        const instance = new InstanceElement('instance', workflowType, WITH_UNSUPPORTED_POST_FUNCTIONS)
        await filter.onFetch?.([instance])
        expect(instance.value.transitions[transitionKeyMap.tran1Initial].rules.postFunctions).toEqual([
          { type: 'AssignToCurrentUserFunction' },
          { type: 'UpdateIssueStatusFunction' },
          {},
        ])
        expect(instance.value.transitions[transitionKeyMap.tran2].rules.postFunctions).toEqual([
          { type: 'AssignToCurrentUserFunction' },
          {},
        ])
      })
    })

    describe('validators', () => {
      it('should remove name', async () => {
        const instance = new InstanceElement('instance', workflowType, WITH_VALIDATORS)
        await filter.onFetch?.([instance])
        expect(instance.value.transitions[transitionKeyMap.tran1].rules.validators).toEqual([
          {
            type: 'ParentStatusValidator',
            configuration: {
              parentStatuses: [
                {
                  id: '1',
                },
              ],
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
        ])
      })

      it('should remove id from validators with an extension type', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [
            {
              name: 'tran1',
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
        })
        await filter.onFetch?.([instance])
        expect(instance.value.transitions[transitionKeyMap.tran1].rules.validators).toEqual([
          {
            type: 'com.innovalog.jmwe.jira-misc-workflow-extensions__LinkIssuesFunction',
            configuration: {},
          },
        ])
      })

      it('should rename fields to fieldIds', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [
            {
              name: 'tran1',
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
        })
        await filter.onFetch?.([instance])
        expect(instance.value.transitions[transitionKeyMap.tran1].rules.validators).toEqual([
          {
            type: 'ParentStatusValidator',
            configuration: {
              fieldIds: ['1'],
              fieldId: '1',
            },
          },
        ])
      })

      it('should convert windowsDays to number', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [
            {
              name: 'tran1',
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
        })
        await filter.onFetch?.([instance])
        expect(instance.value.transitions[transitionKeyMap.tran1].rules.validators).toEqual([
          {
            type: 'ParentStatusValidator',
            configuration: {
              windowsDays: 1,
            },
          },
        ])
      })
    })
    describe('transitions map', () => {
      it('should convert transitions to a map', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [createEmptyTransition('1'), createEmptyTransition('2')],
        })
        await filter.onFetch?.([instance])
        expect(instance.value.transitions).toEqual({
          [transitionKeyMap.tran1]: createEmptyTransition('1'),
          [transitionKeyMap.tran2]: createEmptyTransition('2'),
        })
      })
      it('should add the correct name to the transition', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [createEmptyTransition('1'), createEmptyTransition('2')],
          statuses: [
            {
              id: '1',
              name: 'status1',
            },
            {
              id: '2',
              name: 'status2',
            },
          ],
        })
        instance.value.transitions[0].from = ['1']
        instance.value.transitions[1].from = ['2']

        await filter.onFetch?.([instance])
        expect(instance.value.transitions[naclCase('tran1::From: status1::Directed')].name).toEqual('tran1')
        expect(instance.value.transitions[naclCase('tran2::From: status2::Directed')].name).toEqual('tran2')
      })
      it('should add all from statuses in the correct order', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [createEmptyTransition('1')],
          statuses: [
            {
              id: '1',
              name: 'b',
            },
            {
              id: '2',
              name: 'cc',
            },
            {
              id: '3',
              name: 'aaa',
            },
          ],
        })
        instance.value.transitions[0].from = ['2', '3', '1']
        await filter.onFetch?.([instance])
        expect(Object.keys(instance.value.transitions)).toEqual([naclCase('tran1::From: aaa,b,cc::Directed')])
      })
      it('should add global transition key correctly', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [createEmptyTransition('1')],
        })
        instance.value.transitions[0].to = ['1']
        await filter.onFetch?.([instance])
        expect(Object.keys(instance.value.transitions)).toEqual([naclCase('tran1::From: any status::Global')])
      })
      it('should add global circular transition key correctly', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [createEmptyTransition('1')],
        })
        await filter.onFetch?.([instance])
        expect(Object.keys(instance.value.transitions)).toEqual([naclCase('tran1::From: any status::Circular')])
      })
      it('should add initial transition key correctly', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [createEmptyTransition('1')],
        })
        instance.value.transitions[0].type = 'initial'
        await filter.onFetch?.([instance])
        expect(Object.keys(instance.value.transitions)).toEqual([naclCase('tran1::From: none::Initial')])
      })
      it('should add transition key differentiators correctly', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          transitions: [
            createEmptyTransition('1'),
            createEmptyTransition('1'),
            createEmptyTransition('2'),
            createEmptyTransition('1'),
          ],
        })
        await filter.onFetch?.([instance])
        expect(Object.keys(instance.value.transitions)[0]).toEqual(naclCase('tran1::From: any status::Circular::1'))
        expect(Object.keys(instance.value.transitions)[1]).toEqual(naclCase('tran1::From: any status::Circular::2'))
        expect(Object.keys(instance.value.transitions)[3]).toEqual(naclCase('tran1::From: any status::Circular::3'))
      })
      it('should issue a fetch warning when same key transitions', async () => {
        const instance = new InstanceElement('instance', workflowType, {
          id: {
            name: 'instance',
          },
          transitions: [
            createEmptyTransition('1'),
            createEmptyTransition('1'),
            createEmptyTransition('1'),
            createEmptyTransition('2'),
            createEmptyTransition('3'),
            createEmptyTransition('2'),
          ],
        })
        const fetchResults = await filter.onFetch?.([instance])
        // expect(fetchResults?.errors).toHaveLength(1)
        expect(fetchResults).toEqual({
          errors: [
            {
              severity: 'Warning',
              message: `The following transitions of workflow instance are not unique: tran1, tran2.
It is strongly recommended to rename these transitions so they are unique in Jira, then re-fetch`,
            },
          ],
        })
      })
    })

    it('should not convert invalid workflow', async () => {
      const instance = new InstanceElement('instance', workflowType, {
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
      })
      await filter.onFetch?.([instance])
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
