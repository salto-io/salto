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
import _ from 'lodash'
import {
  CORE_ANNOTATIONS,
  InstanceElement,
  ObjectType,
  BuiltinTypes,
  ElemID,
  ListType,
  ReferenceExpression,
  toChange,
  MapType,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { naclCase } from '@salto-io/adapter-utils'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { logger } from '@salto-io/logging'
import { FilterResult } from '../../../src/filter'
import JiraClient from '../../../src/client/client'
import workflowFilter from '../../../src/filters/workflowV2/workflow_filter'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import {
  WORKFLOW_CONFIGURATION_TYPE,
  ISSUE_TYPE_NAME,
  JIRA,
  PROJECT_TYPE,
  STATUS_CATEGORY_TYPE_NAME,
  STATUS_TYPE_NAME,
} from '../../../src/constants'
import { TASK_STATUS } from '../../../src/filters/workflowV2/types'

const uuidMock = jest.fn()
const deployChangeMock = jest.fn()
jest.mock('uuid', () => {
  const actual = jest.requireActual('uuid')
  return {
    ...actual,
    v4: jest.fn((...args) => uuidMock(...args)),
  }
})
const logging = logger('jira-adapter/src/filters/workflowV2/workflow_filter')
const logErrorSpy = jest.spyOn(logging, 'error')

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => deployChangeMock(...args)),
    },
  }
})

describe('workflow filter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'deploy' | 'onDeploy', FilterResult>
  let workflowType: ObjectType
  let workflowRuleConfigurationParametersType: ObjectType
  let elements: ObjectType[]
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  const TRANSITION_NAME_TO_KEY: Record<string, string> = {
    Create: naclCase('Create::From: none::Initial'),
    Done: naclCase('Done::From: any status::Global'),
    ToStatus2: naclCase('ToStatus2::From: Create::Directed'),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    workflowType = createEmptyType(WORKFLOW_CONFIGURATION_TYPE)
    workflowRuleConfigurationParametersType = createEmptyType('WorkflowRuleConfiguration_parameters')
    elements = [workflowType, workflowRuleConfigurationParametersType]
  })

  describe('onFetch', () => {
    let mockPaginator: clientUtils.Paginator
    beforeEach(() => {
      mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
        yield [
          {
            id: { entityId: '1' },
            statuses: [
              { id: '11', name: 'Create' },
              { id: '2', name: 'another one' },
            ],
          },
          { id: { entityId: '2' }, statuses: [{ id: '22', name: 'Quack Quack' }] },
        ]
      })
      const { client: cli, connection: conn } = mockClient()
      client = cli
      connection = conn
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableNewWorkflowAPI = true
      filter = workflowFilter(
        getFilterParams({
          client,
          paginator: mockPaginator,
          config,
        }),
      ) as typeof filter
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          workflows: [
            {
              id: '1',
              name: 'firstWorkflow',
              version: {
                versionNumber: 1,
                id: '1',
              },
              scope: {
                type: 'global',
              },
              transitions: [
                {
                  type: 'INITIAL',
                  name: 'Create',
                  properties: {
                    'jira.issue.editable': 'true',
                  },
                  to: {
                    statusReference: '11',
                  },
                },
                {
                  type: 'DIRECTED',
                  name: 'ToStatus2',
                  from: [
                    {
                      statusReference: '11',
                    },
                  ],
                  to: {
                    statusReference: '2',
                  },
                },
              ],
              statuses: [
                {
                  id: '11',
                  properties: {
                    'jira.issue.editable': 'true',
                  },
                },
                {
                  id: '2',
                },
              ],
            },
            {
              id: '2',
              name: 'secondWorkflow',
              version: {
                versionNumber: 1,
                id: '2',
              },
              scope: {
                type: 'global',
              },
              statuses: [
                {
                  id: '22',
                  properties: {
                    'jira.issue.editable': 'true',
                  },
                },
              ],
              transitions: [
                {
                  type: 'GLOBAL',
                  name: 'Done',
                  to: {
                    statusReference: '22',
                  },
                },
              ],
            },
          ],
        },
      })
    })
    it('should add workflow instances', async () => {
      await filter.onFetch(elements)
      expect(elements).toHaveLength(4)
      const firstWorkflow = elements[2] as unknown as InstanceElement
      expect(firstWorkflow.elemID.name).toEqual('firstWorkflow')
      expect(firstWorkflow.value).toEqual({
        id: '1',
        name: 'firstWorkflow',
        version: {
          versionNumber: 1,
          id: '1',
        },
        scope: {
          type: 'global',
        },
        transitions: {
          [TRANSITION_NAME_TO_KEY.Create]: {
            type: 'INITIAL',
            name: 'Create',
            properties: [
              {
                key: 'jira.issue.editable',
                value: 'true',
              },
            ],
            to: {
              statusReference: '11',
            },
          },
          [TRANSITION_NAME_TO_KEY.ToStatus2]: {
            type: 'DIRECTED',
            name: 'ToStatus2',
            from: [
              {
                statusReference: '11',
              },
            ],
            to: {
              statusReference: '2',
            },
          },
        },
        statuses: [
          {
            id: '11',
            properties: [
              {
                key: 'jira.issue.editable',
                value: 'true',
              },
            ],
          },
          {
            id: '2',
          },
        ],
      })
      const secondWorkflow = elements[3] as unknown as InstanceElement
      expect(secondWorkflow.elemID.name).toEqual('secondWorkflow')
      expect(secondWorkflow.value).toEqual({
        id: '2',
        name: 'secondWorkflow',
        version: {
          versionNumber: 1,
          id: '2',
        },
        scope: {
          type: 'global',
        },
        transitions: {
          [TRANSITION_NAME_TO_KEY.Done]: {
            type: 'GLOBAL',
            name: 'Done',
            to: {
              statusReference: '22',
            },
          },
        },
        statuses: [
          {
            id: '22',
            properties: [
              {
                key: 'jira.issue.editable',
                value: 'true',
              },
            ],
          },
        ],
      })
    })
    it('should add workflows deployment annotations to WorkflowConfiguration type', async () => {
      await filter.onFetch(elements)
      expect(elements).toHaveLength(4)
      expect(elements[0].annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.DELETABLE]: true,
      })
    })
    it('should add deployment annotations to scriptRunner type', async () => {
      await filter.onFetch(elements)
      expect(elements).toHaveLength(4)
      expect(elements[1].fields.scriptRunner.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })
    it('should call paginator with the correct parameters', async () => {
      await filter.onFetch(elements)
      expect(mockPaginator).toHaveBeenCalledWith(
        {
          url: '/rest/api/3/workflow/search',
          paginationField: 'startAt',
          queryParams: {
            expand: 'statuses',
          },
        },
        expect.anything(),
      )
    })
    it('should call the client with the correct parameters', async () => {
      await filter.onFetch(elements)
      expect(connection.post).toHaveBeenCalledWith(
        '/rest/api/3/workflows',
        {
          workflowIds: ['1', '2'],
        },
        undefined,
      )
    })
    it('should not add workflow instances if new workflow api is disabled', async () => {
      config.fetch.enableNewWorkflowAPI = false
      filter = workflowFilter(
        getFilterParams({
          client,
          paginator: mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
            yield [{ id: { entityId: '1' } }, { id: { entityId: '2' } }]
          }),
          config,
        }),
      ) as typeof filter
      await filter.onFetch(elements)
      expect(elements).toHaveLength(2)
    })
    it('should fail when WorkflowConfiguration type is not found', async () => {
      const filterResult = (await filter.onFetch([])) as FilterResult
      const errors = filterResult.errors ?? []
      expect(errors).toBeDefined()
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Failed to fetch Workflows.')
      expect(errors[0].severity).toEqual('Error')
    })
    it('should fail when id response data is not valid', async () => {
      mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
        yield [{ id: { notEntityId: '1' } }]
      })
      filter = workflowFilter(
        getFilterParams({
          client,
          paginator: mockPaginator,
          config,
        }),
      ) as typeof filter

      const filterResult = (await filter.onFetch(elements)) as FilterResult

      const errors = filterResult?.errors ?? []
      expect(errors).toBeDefined()
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Failed to fetch Workflows.')
      expect(errors[0].severity).toEqual('Error')
    })
    it('should fail when bulk get post request is rejected', async () => {
      connection.post.mockRejectedValue(new Error('code 400'))
      const filterResult = (await filter.onFetch(elements)) as FilterResult
      const errors = filterResult?.errors ?? []
      expect(errors).toBeDefined()
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual(
        'Failed to fetch Workflows: Failed to post /rest/api/3/workflows with error: Error: code 400.',
      )
      expect(errors[0].severity).toEqual('Error')
    })
    it('should throw when response data is not valid', async () => {
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          workflows: [
            {
              version: {
                invalidVersion: true,
              },
            },
          ],
        },
      })
      const filterResult = (await filter.onFetch(elements)) as FilterResult
      const errors = filterResult?.errors ?? []
      expect(errors).toBeDefined()
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Failed to fetch Workflows.')
      expect(errors[0].severity).toEqual('Error')
    })

    it('should return a warning when there are two transitions with the same key', async () => {
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          workflows: [
            {
              id: '1',
              name: 'workflow',
              version: {
                versionNumber: 1,
                id: '1',
              },
              scope: {
                type: 'global',
              },
              transitions: [
                {
                  id: '1',
                  name: 'Create',
                  to: {
                    statusReference: 'uuid1',
                  },
                  type: 'INITIAL',
                },
                {
                  id: '2',
                  name: 'Create',
                  to: {
                    statusReference: 'uuid2',
                  },
                  type: 'INITIAL',
                },
              ],
              statuses: [],
            },
          ],
        },
      })
      const filterResult = (await filter.onFetch(elements)) as FilterResult
      const errors = filterResult?.errors ?? []
      expect(elements).toHaveLength(3)
      expect(errors).toHaveLength(1)
      expect(errors[0].severity).toEqual('Warning')
      expect(errors[0].message).toEqual(
        `The following transitions of workflow workflow are not unique: Create.
It is strongly recommended to rename these transitions so they are unique in Jira, then re-fetch`,
      )
    })

    describe('transition parameters', () => {
      beforeEach(() => {
        connection.post.mockResolvedValue({
          status: 200,
          data: {
            workflows: [
              {
                id: '1',
                name: 'workflow',
                version: {
                  versionNumber: 1,
                  id: '1',
                },
                scope: {
                  type: 'global',
                },
                transitions: [
                  {
                    id: '1',
                    name: 'Create',
                    to: {
                      statusReference: 'uuid1',
                    },
                    type: 'INITIAL',
                    conditions: {
                      conditions: [
                        {
                          parameters: {
                            groupIds: '1,2',
                          },
                        },
                        {
                          parameters: {
                            fromStatusId: '1',
                          },
                        },
                        {
                          parameters: undefined,
                          ruleKey: 'ruleKey',
                        },
                        {
                          parameters: {
                            accountIds: 'quack quack',
                            groupIds: '',
                          },
                        },
                      ],
                    },
                    validators: [
                      {
                        parameters: {
                          statusIds: '1,2',
                        },
                      },
                      {
                        parameters: {
                          fieldKey: 'fieldKey',
                        },
                      },
                      {
                        parameters: undefined,
                        ruleKey: 'ruleKey',
                      },
                      {
                        parameters: {
                          fieldsRequired: '',
                          accountIds: 'quack quack',
                        },
                      },
                    ],
                    triggers: [
                      {
                        parameters: {
                          enabledTriggers: 'firstTrigger,secondTrigger',
                        },
                      },
                      {
                        parameters: {
                          anotherParam: 'firstTrigger,secondTrigger',
                        },
                      },
                    ],
                  },
                ],
                statuses: [],
              },
            ],
          },
        })
      })
      it('should convert transition parameters to list', async () => {
        await filter.onFetch(elements)
        expect(elements).toHaveLength(3)
        const workflow = elements[2] as unknown as InstanceElement
        expect(workflow.value.transitions[TRANSITION_NAME_TO_KEY.Create].conditions.conditions[0].parameters).toEqual({
          groupIds: ['1', '2'],
        })
        expect(workflow.value.transitions[TRANSITION_NAME_TO_KEY.Create].validators[0].parameters).toEqual({
          statusIds: ['1', '2'],
        })
        expect(workflow.value.transitions[TRANSITION_NAME_TO_KEY.Create].triggers[0].parameters).toEqual({
          enabledTriggers: ['firstTrigger', 'secondTrigger'],
        })
      })
      it('should do nothing if parameters field not in the relevant list', async () => {
        await filter.onFetch(elements)
        expect(elements).toHaveLength(3)
        const workflow = elements[2] as unknown as InstanceElement
        expect(workflow.value.transitions[TRANSITION_NAME_TO_KEY.Create].conditions.conditions[1].parameters).toEqual({
          fromStatusId: '1',
        })
        expect(workflow.value.transitions[TRANSITION_NAME_TO_KEY.Create].validators[1].parameters).toEqual({
          fieldKey: 'fieldKey',
        })
        expect(workflow.value.transitions[TRANSITION_NAME_TO_KEY.Create].triggers[1].parameters).toEqual({
          anotherParam: 'firstTrigger,secondTrigger',
        })
      })
      it('should do nothing if parameters is undefined', async () => {
        await filter.onFetch(elements)
        expect(elements).toHaveLength(3)
        const workflow = elements[2] as unknown as InstanceElement
        expect(
          workflow.value.transitions[TRANSITION_NAME_TO_KEY.Create].conditions.conditions[2].parameters,
        ).toBeUndefined()
        expect(workflow.value.transitions[TRANSITION_NAME_TO_KEY.Create].validators[2].parameters).toBeUndefined()
      })
      it('should remove empty strings', async () => {
        await filter.onFetch(elements)
        expect(elements).toHaveLength(3)
        const workflow = elements[2] as unknown as InstanceElement
        expect(
          workflow.value.transitions[TRANSITION_NAME_TO_KEY.Create].conditions.conditions[3].parameters.groupIds,
        ).toBeUndefined()
        expect(
          workflow.value.transitions[TRANSITION_NAME_TO_KEY.Create].validators[3].parameters.fieldsRequired,
        ).toBeUndefined()
      })
    })
  })
  describe('Deploy', () => {
    const WORKFLOW_PAYLOAD = {
      statuses: [
        {
          id: '1',
          name: 'status1',
          statusCategory: 'DONE',
          statusReference: 'uuid1',
        },
        {
          id: '2',
          name: 'status2',
          statusCategory: 'DONE',
          statusReference: 'uuid2',
        },
      ],
      workflows: [
        {
          description: 'description',
          name: 'workflow',
          id: '1',
          scope: {
            type: 'global',
          },
          version: {
            id: '1',
            versionNumber: 1,
          },
          startPointLayout: {
            x: 12,
            y: 34,
          },
          statuses: [
            {
              layout: {
                x: 12,
                y: 34,
              },
              statusReference: 'uuid1',
              properties: {
                'jira.issue.editable': 'true',
              },
            },
            {
              layout: {
                x: 45,
                y: 67,
              },
              statusReference: 'uuid2',
            },
          ],
          transitions: [
            {
              id: '1',
              name: 'Create',
              to: {
                statusReference: 'uuid1',
              },
              type: 'INITIAL',
              conditions: {
                operation: 'ALL',
                conditionGroups: [],
              },
              properties: {
                'jira.issue.editable': 'true',
              },
            },
            {
              id: '2',
              name: 'toStatus2',
              from: [
                {
                  port: 3,
                  statusReference: 'uuid1',
                },
              ],
              to: {
                port: 7,
                statusReference: 'uuid2',
              },
              type: 'DIRECTED',
              conditions: {
                operation: 'ALL',
                conditionGroups: [
                  {
                    operation: 'ALL',
                    conditionGroups: [],
                  },
                ],
              },
            },
          ],
        },
      ],
      scope: {
        type: 'global',
      },
    }
    const MODIFICATION_WORKFLOW_PAYLOAD = {
      ...WORKFLOW_PAYLOAD,
      scope: undefined,
      workflows: [
        {
          ...WORKFLOW_PAYLOAD.workflows[0],
          statuses: [WORKFLOW_PAYLOAD.workflows[0].statuses[0]],
          transitions: [WORKFLOW_PAYLOAD.workflows[0].transitions[0]],
          version: {
            id: '1',
            versionNumber: 1,
          },
          id: '1',
          statusMappings: [
            {
              issueTypeId: '11',
              projectId: '22',
              statusMigrations: [
                {
                  newStatusReference: 'uuid1',
                  oldStatusReference: 'uuid2',
                },
              ],
            },
          ],
        },
      ],
    }

    let workflowReferenceStatusType: ObjectType
    let WorkflowStatusAndPortType: ObjectType
    let transitionType: ObjectType
    let statusMappingType: ObjectType
    let statusMigrationType: ObjectType
    let statusType: ObjectType
    let statusCategoryType: ObjectType
    let ruleConfigurationType: ObjectType
    let transitionParametersType: ObjectType
    let conditionGroupConfigurationType: ObjectType
    let workflowInstance: InstanceElement
    let workflowInstanceBefore: InstanceElement
    let preDeployWorkflowInstance: InstanceElement
    let statusCategory1: InstanceElement
    let status1: InstanceElement
    let status2: InstanceElement

    const modificationSetup = (): void => {
      workflowInstanceBefore = _.cloneDeep(workflowInstance)
      const issueTypeInstance = new InstanceElement('issueType', createEmptyType(ISSUE_TYPE_NAME), { id: '11' })
      const projectInstance = new InstanceElement('project', createEmptyType(PROJECT_TYPE), { id: '22' })
      const statusMapping = [
        {
          issueTypeId: new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance),
          projectId: new ReferenceExpression(projectInstance.elemID, projectInstance),
          statusMigrations: [
            {
              newStatusReference: new ReferenceExpression(status1.elemID, status1),
              oldStatusReference: new ReferenceExpression(status2.elemID, status2),
            },
          ],
        },
      ]
      workflowInstance.value.statusMappings = statusMapping
      workflowInstance.value.statuses.pop()
      delete workflowInstance.value.transitions[TRANSITION_NAME_TO_KEY.ToStatus2]
    }
    beforeEach(() => {
      // types
      statusCategoryType = createEmptyType(STATUS_CATEGORY_TYPE_NAME)
      statusType = createEmptyType(STATUS_TYPE_NAME)
      WorkflowStatusAndPortType = new ObjectType({
        elemID: new ElemID(JIRA, 'WorkflowStatusAndPort'),
        fields: {
          statusReference: { refType: BuiltinTypes.STRING },
          port: { refType: BuiltinTypes.NUMBER },
        },
      })
      transitionParametersType = new ObjectType({
        elemID: new ElemID(JIRA, 'WorkflowRuleConfiguration_parameters'),
        fields: {
          groupIds: { refType: new ListType(BuiltinTypes.STRING) },
          fromStatusId: { refType: BuiltinTypes.STRING },
        },
      })
      ruleConfigurationType = new ObjectType({
        elemID: new ElemID(JIRA, 'WorkflowRuleConfiguration'),
        fields: {
          parameters: { refType: transitionParametersType },
        },
      })
      conditionGroupConfigurationType = new ObjectType({
        elemID: new ElemID(JIRA, 'ConditionGroupConfiguration'),
        fields: {
          conditions: { refType: new ListType(ruleConfigurationType) },
        },
      })
      transitionType = new ObjectType({
        elemID: new ElemID(JIRA, 'WorkflowTransitions'),
        fields: {
          id: { refType: BuiltinTypes.STRING },
          conditions: { refType: conditionGroupConfigurationType },
          name: { refType: BuiltinTypes.STRING },
          type: { refType: BuiltinTypes.STRING },
          from: { refType: new ListType(WorkflowStatusAndPortType) },
          to: { refType: WorkflowStatusAndPortType },
        },
      })

      workflowReferenceStatusType = new ObjectType({
        elemID: new ElemID(JIRA, 'WorkflowReferenceStatus'),
        fields: {
          statusReference: { refType: BuiltinTypes.STRING },
          port: { refType: BuiltinTypes.NUMBER },
        },
      })
      statusMigrationType = new ObjectType({
        elemID: new ElemID(JIRA, 'StatusMigration'),
        fields: {
          newStatusReference: { refType: BuiltinTypes.STRING },
          oldStatusReference: { refType: BuiltinTypes.STRING },
        },
      })
      statusMappingType = new ObjectType({
        elemID: new ElemID(JIRA, 'StatusMappingDTO'),
        fields: {
          issueTypeId: { refType: BuiltinTypes.STRING },
          projectId: { refType: BuiltinTypes.STRING },
          statusMigrations: { refType: new ListType(statusMigrationType) },
        },
      })
      workflowType = new ObjectType({
        elemID: new ElemID(JIRA, WORKFLOW_CONFIGURATION_TYPE),
        fields: {
          statuses: { refType: workflowReferenceStatusType },
          transitions: { refType: new MapType(transitionType) },
          statusMappings: { refType: new ListType(statusMappingType) },
        },
      })
      // instances
      statusCategory1 = new InstanceElement('statusCategory', statusCategoryType, { id: '3', key: 'done' })
      status1 = new InstanceElement('status1', statusType, {
        id: '1',
        name: 'status1',
        statusCategory: new ReferenceExpression(statusCategory1.elemID, statusCategory1),
      })
      status2 = new InstanceElement('status2', statusType, {
        id: '2',
        name: 'status2',
        statusCategory: new ReferenceExpression(statusCategory1.elemID, statusCategory1),
      })
      workflowInstance = new InstanceElement('workflow', workflowType, {
        name: 'workflow',
        description: 'description',
        scope: {
          type: 'global',
        },
        version: {
          versionNumber: 1,
          id: '1',
        },
        id: '1',
        startPointLayout: {
          x: 12,
          y: 34,
        },
        statuses: [
          {
            statusReference: new ReferenceExpression(status1.elemID, status1),
            layout: {
              x: 12,
              y: 34,
            },
            properties: [
              {
                key: 'jira.issue.editable',
                value: 'true',
              },
            ],
          },
          {
            statusReference: new ReferenceExpression(status2.elemID, status2),
            layout: {
              x: 45,
              y: 67,
            },
          },
        ],
        transitions: {
          [TRANSITION_NAME_TO_KEY.Create]: {
            id: '1',
            type: 'INITIAL',
            name: 'Create',
            to: {
              statusReference: new ReferenceExpression(status1.elemID, status1),
            },
            conditions: {
              operation: 'ALL',
            },
            properties: [
              {
                key: 'jira.issue.editable',
                value: 'true',
              },
            ],
          },
          [TRANSITION_NAME_TO_KEY.ToStatus2]: {
            id: '2',
            type: 'DIRECTED',
            name: 'toStatus2',
            from: [
              {
                statusReference: new ReferenceExpression(status1.elemID, status1),
                port: 3,
              },
            ],
            to: {
              statusReference: new ReferenceExpression(status2.elemID, status2),
              port: 7,
            },
            conditions: {
              operation: 'ALL',
              conditionGroups: [
                {
                  operation: 'ALL',
                },
              ],
            },
          },
        },
      })
      const { client: cli, connection: conn } = mockClient()
      client = cli
      connection = conn
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.deploy.taskMaxRetries = 3
      filter = workflowFilter(
        getFilterParams({
          client,
          config,
        }),
      ) as typeof filter
    })
    describe('preDeploy', () => {
      let groupType: ObjectType
      let group1: InstanceElement
      let group2: InstanceElement

      beforeEach(() => {
        groupType = createEmptyType('Group')
        group1 = new InstanceElement('group1', groupType, { groupId: '1' })
        group2 = new InstanceElement('group2', groupType, { groupId: '2' })
        preDeployWorkflowInstance = workflowInstance.clone()
        uuidMock.mockReturnValueOnce('uuid1').mockReturnValueOnce('uuid2')
        deployChangeMock.mockResolvedValue({
          workflows: [
            {
              id: '1',
              name: 'workflow',
              version: {
                versionNumber: 1,
                id: '1',
              },
              scope: {
                type: 'global',
              },
            },
          ],
        })
      })
      describe('addition', () => {
        it('should create workflow payload correctly', async () => {
          await filter.preDeploy([toChange({ after: workflowInstance })])
          expect(workflowInstance.value).toEqual(WORKFLOW_PAYLOAD)
        })
        it('should create workflow payload correctly when statuses and transition are undefined', async () => {
          workflowInstance.value.statuses = undefined
          workflowInstance.value.transitions = undefined
          await filter.preDeploy([toChange({ after: workflowInstance })])
          expect(workflowInstance.value).toEqual({
            ...WORKFLOW_PAYLOAD,
            workflows: [
              {
                ...WORKFLOW_PAYLOAD.workflows[0],
                transitions: [],
                statuses: undefined,
              },
            ],
            statuses: [],
          })
        })
        describe('transition parameters', () => {
          beforeEach(() => {
            const conditions = {
              conditions: [
                {
                  parameters: {
                    groupIds: [
                      new ReferenceExpression(group1.elemID, group1),
                      new ReferenceExpression(group2.elemID, group2),
                    ],
                  },
                },
                {
                  parameters: {
                    fromStatusId: new ReferenceExpression(status1.elemID, status1),
                  },
                },
                {
                  parameters: undefined,
                  ruleKey: 'ruleKey',
                },
                {
                  parameters: {
                    groupIds: [],
                  },
                },
              ],
            }
            workflowInstance.value.transitions[TRANSITION_NAME_TO_KEY.ToStatus2].conditions = conditions
          })
          it('should convert transition parameters to concat string', async () => {
            await filter.preDeploy([toChange({ after: workflowInstance })])
            expect(workflowInstance.value.workflows[0].transitions[1].conditions.conditions[0].parameters).toEqual({
              groupIds: '1,2',
            })
          })
          it('should do nothing if parameters field not in the relevant list', async () => {
            await filter.preDeploy([toChange({ after: workflowInstance })])
            expect(workflowInstance.value.workflows[0].transitions[1].conditions.conditions[1].parameters).toEqual({
              fromStatusId: '1',
            })
          })
          it('should do nothing if parameters is undefined', async () => {
            await filter.preDeploy([toChange({ after: workflowInstance })])
            expect(
              workflowInstance.value.workflows[0].transitions[1].conditions.conditions[2].parameters,
            ).toBeUndefined()
          })
          it('should convert parameters to empty string if it is an empty array', async () => {
            await filter.preDeploy([toChange({ after: workflowInstance })])
            expect(workflowInstance.value.workflows[0].transitions[1].conditions.conditions[3].parameters).toEqual({
              groupIds: '',
            })
          })
        })
      })
      describe('modification', () => {
        beforeEach(() => {
          modificationSetup()
        })
        it('should create workflow payload correctly', async () => {
          await filter.preDeploy([toChange({ before: workflowInstanceBefore, after: workflowInstance })])
          expect(workflowInstance.value).toEqual(MODIFICATION_WORKFLOW_PAYLOAD)
        })
      })
    })
    describe('deploy', () => {
      describe('addition', () => {
        beforeEach(() => {
          workflowInstance.value = WORKFLOW_PAYLOAD
        })
        it('should add the new id, version and scope to the workflow instance', async () => {
          await filter.deploy([toChange({ after: workflowInstance })])
          expect(workflowInstance.value.workflows[0].id).toEqual('1')
          expect(workflowInstance.value.workflows[0].version).toEqual({
            versionNumber: 1,
            id: '1',
          })
          expect(workflowInstance.value.workflows[0].scope).toEqual({
            type: 'global',
          })
        })
        it('should not insert id and version when workflow response is invalid', async () => {
          deployChangeMock.mockResolvedValueOnce({ workflows: [{ name: 'workflow' }] })
          workflowInstance.value.workflows[0].id = undefined
          workflowInstance.value.workflows[0].version = undefined
          await filter.deploy([toChange({ after: workflowInstance })])
          expect(workflowInstance.value.workflows[0].id).toBeUndefined()
          expect(workflowInstance.value.workflows[0].version).toBeUndefined()
        })
      })
      describe('modification', () => {
        beforeEach(() => {
          modificationSetup()
          deployChangeMock.mockResolvedValue({
            workflows: [
              {
                id: '1',
                name: 'workflow',
                version: {
                  versionNumber: 1,
                  id: '1',
                },
                scope: {
                  type: 'global',
                },
                statuses: [],
                transitions: [
                  {
                    name: 'Create',
                    type: 'INITIAL',
                  },
                ],
              },
            ],
            taskId: '1',
          })
          workflowInstance.value = MODIFICATION_WORKFLOW_PAYLOAD
        })
        it('should wait for successful status migration', async () => {
          connection.get
            .mockResolvedValueOnce({
              status: 200,
              data: {
                status: TASK_STATUS.RUNNING,
                progress: 50,
              },
            })
            .mockResolvedValueOnce({
              status: 200,
              data: {
                status: TASK_STATUS.COMPLETE,
                progress: 100,
              },
            })
          const result = await filter.deploy([toChange({ before: workflowInstanceBefore, after: workflowInstance })])
          expect(result.deployResult.errors).toHaveLength(0)
          expect(connection.get).toHaveBeenCalledTimes(2)
          expect(connection.get).toHaveBeenCalledWith('/rest/api/3/task/1', expect.anything())
        })
        it('should not fail the deployment if the migration fails', async () => {
          connection.get.mockResolvedValueOnce({
            status: 200,
            data: {
              status: TASK_STATUS.CANCELLED,
              progress: 50,
            },
          })
          const result = await filter.deploy([toChange({ before: workflowInstanceBefore, after: workflowInstance })])
          expect(result.deployResult.errors).toHaveLength(0)
          expect(connection.get).toHaveBeenCalledTimes(1)
          expect(connection.get).toHaveBeenCalledWith('/rest/api/3/task/1', expect.anything())
          expect(logErrorSpy).toHaveBeenCalledWith(
            'Status migration failed for workflow: workflow, with status CANCELLED',
          )
        })
        it('should not fail the deployment when the migration timeout pass', async () => {
          connection.get.mockResolvedValue({
            status: 200,
            data: {
              status: TASK_STATUS.RUNNING,
              progress: 50,
            },
          })
          const result = await filter.deploy([toChange({ before: workflowInstanceBefore, after: workflowInstance })])
          expect(result.deployResult.errors).toHaveLength(0)
          expect(connection.get).toHaveBeenCalledTimes(4)
          expect(connection.get).toHaveBeenCalledWith('/rest/api/3/task/1', expect.anything())
          expect(logErrorSpy).toHaveBeenCalledWith(
            'Failed to run status migration for workflow: workflow - did not receive success response after await timeout',
          )
        })
        it('should not fail the deployment statusMigration task response have unknown status', async () => {
          connection.get.mockResolvedValue({
            status: 200,
            data: {
              status: 'UNKNOWN',
              progress: 50,
            },
          })
          const result = await filter.deploy([toChange({ before: workflowInstanceBefore, after: workflowInstance })])
          expect(result.deployResult.errors).toHaveLength(0)
          expect(connection.get).toHaveBeenCalledTimes(1)
          expect(connection.get).toHaveBeenCalledWith('/rest/api/3/task/1', expect.anything())
          expect(logErrorSpy).toHaveBeenCalledWith(
            'Status migration failed for workflow: workflow, with unknown status UNKNOWN',
          )
        })
        it('should not fail the deployment if task response is invalid', async () => {
          connection.get.mockResolvedValueOnce({
            status: 200,
            data: {},
          })
          const result = await filter.deploy([toChange({ before: workflowInstanceBefore, after: workflowInstance })])
          expect(result.deployResult.errors).toHaveLength(0)
          expect(connection.get).toHaveBeenCalledTimes(1)
          expect(connection.get).toHaveBeenCalledWith('/rest/api/3/task/1', expect.anything())
        })
      })
    })
    describe('onDeploy', () => {
      describe('addition', () => {
        beforeEach(async () => {
          preDeployWorkflowInstance = _.cloneDeep(workflowInstance)
          uuidMock.mockReturnValueOnce('uuid1').mockReturnValueOnce('uuid2')
          deployChangeMock.mockResolvedValue({
            workflows: [
              {
                id: '1',
                name: 'workflow',
                version: {
                  versionNumber: 1,
                  id: '1',
                },
                scope: {
                  type: 'global',
                },
              },
            ],
          })
          await filter.preDeploy([toChange({ after: workflowInstance })])
          await filter.deploy([toChange({ after: workflowInstance })])
          await filter.onDeploy([toChange({ after: workflowInstance })])
        })
        it('should undo the preDeploy changes', async () => {
          expect(workflowInstance).toEqual(preDeployWorkflowInstance)
        })
      })
      describe('modification', () => {
        beforeEach(async () => {
          modificationSetup()
          connection.post.mockResolvedValueOnce({
            status: 200,
            data: {
              workflows: [
                {
                  id: '1',
                  name: 'workflow',
                  version: {
                    versionNumber: 2,
                    id: '1',
                  },
                  scope: {
                    type: 'global',
                  },
                  statuses: [],
                  transitions: [
                    {
                      type: 'INITIAL',
                      name: 'Create',
                    },
                  ],
                },
              ],
            },
          })
          connection.get.mockResolvedValueOnce({
            status: 200,
            data: {
              status: TASK_STATUS.COMPLETE,
              progress: 100,
            },
          })
          await filter.preDeploy([toChange({ before: workflowInstanceBefore, after: workflowInstance })])
          await filter.deploy([toChange({ before: workflowInstanceBefore, after: workflowInstance })])
          await filter.onDeploy([toChange({ before: workflowInstanceBefore, after: workflowInstance })])
        })
        it('should undo the preDeploy changes', async () => {
          workflowInstanceBefore.value.statuses.pop()
          delete workflowInstanceBefore.value.transitions[TRANSITION_NAME_TO_KEY.ToStatus2]
          const { statuses: statusesBefore, transitions: transitionsBefore } = workflowInstanceBefore.value
          const { statuses: statusesAfter, transitions: transitionsAfter } = workflowInstance.value
          expect(statusesAfter).toEqual(statusesBefore)
          expect(transitionsAfter).toEqual(transitionsBefore)
        })
        it('should update workflow version number', async () => {
          const { version } = workflowInstance.value
          expect(version).toEqual({
            versionNumber: 2,
            id: '1',
          })
        })
        it('should not update version when the workflow response is invalid', async () => {
          connection.post.mockResolvedValueOnce({
            status: 200,
            data: {},
          })
          workflowInstance.value = MODIFICATION_WORKFLOW_PAYLOAD
          await filter.onDeploy([toChange({ before: workflowInstanceBefore, after: workflowInstance })])
          const { version } = workflowInstance.value
          expect(version).toEqual({
            versionNumber: 1,
            id: '1',
          })
        })
      })
    })
  })
})
