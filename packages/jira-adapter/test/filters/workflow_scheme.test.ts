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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ObjectType, toChange, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { ISSUE_TYPE_NAME, JIRA, STATUS_TYPE_NAME } from '../../src/constants'
import { getFilterParams, mockClient } from '../utils'
import workflowSchemeFilter, { MAX_TASK_CHECKS } from '../../src/filters/workflow_scheme'
import { Filter } from '../../src/filter'
import { getDefaultConfig } from '../../src/config/config'
import JiraClient from '../../src/client/client'

const logging = logger('jira-adapter/src/filters/workflow_scheme')
const logErrorSpy = jest.spyOn(logging, 'warn')

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
class ServiceError {
  response: {data: {errorMessages: string[]}}
  constructor(messages: string[]) {
    this.response = { data: { errorMessages: messages } }
  }
}

describe('workflowScheme', () => {
  let workflowSchemeType: ObjectType
  let filter: Filter
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let elementsSource: ReadOnlyElementsSource
  beforeEach(async () => {
    jest.clearAllMocks()
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn
    elementsSource = buildElementsSourceFromElements([])

    filter = workflowSchemeFilter(getFilterParams({
      client,
      paginator,
      elementsSource,
    }))
    workflowSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'WorkflowScheme'),
    })
  })

  describe('onFetch', () => {
    it('should add statusMigrations', async () => {
      await filter.onFetch?.([workflowSchemeType])
      expect(workflowSchemeType.fields.statusMigrations).toBeDefined()
      expect(workflowSchemeType.fields.statusMigrations.annotations).toEqual({
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })
    it('replace field issueTypeMappings with items', async () => {
      workflowSchemeType.fields.issueTypeMappings = new Field(workflowSchemeType, 'issueTypeMappings', BuiltinTypes.STRING)
      await filter.onFetch?.([workflowSchemeType])
      expect(workflowSchemeType.fields.issueTypeMappings).toBeUndefined()
      expect(workflowSchemeType.fields.items).toBeDefined()
      expect(workflowSchemeType.fields.items.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('replace value of issueTypeMappings with items', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          issueTypeMappings: {
            additionalProperties: {
              1234: 'workflow name',
            },
          },
        }
      )
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        items: [
          {
            issueType: '1234',
            workflow: 'workflow name',
          },
        ],
      })
    })

    it('do nothing if there are no issueTypeMappings', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          val: 1,
        }
      )
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        val: 1,
      })
    })
  })

  describe('preDeploy', () => {
    it('add issueTypeMappings to instance', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
        }
      )
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        items: [
          {
            issueType: 1234,
            workflow: 'workflow name',
          },
        ],
        issueTypeMappings: {
          1234: 'workflow name',
        },
      })
    })

    it('add updateDraftIfNeeded to instance if modification', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
        }
      )
      await filter.preDeploy?.([toChange({ before: instance, after: instance })])
      expect(instance.value).toEqual({
        updateDraftIfNeeded: true,
        issueTypeMappings: {},
      })
    })

    it('should add empty list if there are no items', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          val: 1,
        }
      )
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        val: 1,
        issueTypeMappings: {},
      })
    })
  })

  describe('deploy', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<
        typeof deployment.deployChange
      >

    beforeEach(() => {
      deployChangeMock.mockClear()
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: TimerHandler) => (_.isFunction(cb) ? cb() : undefined))
    })
    it('ignore items when deploying', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
          issueTypeMappings: {
            1234: 'workflow name',
          },
        }
      )

      const change = toChange({ after: instance })
      await filter.deploy?.([change])
      expect(deployChangeMock).toHaveBeenCalledWith({
        change,
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false })
          .apiDefinitions.types.WorkflowScheme.deployRequests,
        fieldsToIgnore: ['items'],
        elementsSource,
      })
    })

    it('when draft should call publish draft', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          id: '1',
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
          issueTypeMappings: {
            1234: 'workflow name',
          },
          statusMigrations: [
            {
              issueTypeId: '1',
              statusId: '2',
              newStatusId: '3',
            },
          ],
        }
      )

      deployChangeMock.mockResolvedValue({ draft: true })
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          self: 'taskUrl',
        },
      })

      connection.get.mockResolvedValue({
        status: 200,
        data: {
          self: 'taskUrl',
          result: 'done',
          status: 'COMPLETE',
        },
      })


      const instanceBefore = instance.clone()
      instanceBefore.value.description = 'desc'
      await filter.deploy?.([toChange({ before: instanceBefore, after: instance })])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({ before: instanceBefore, after: instance }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false })
          .apiDefinitions.types.WorkflowScheme.deployRequests,
        fieldsToIgnore: ['items'],
        elementsSource,
      })

      expect(connection.post).toHaveBeenCalledWith(
        '/rest/api/3/workflowscheme/1/draft/publish',
        {
          statusMappings: [
            {
              issueTypeId: '1',
              statusId: '2',
              newStatusId: '3',
            },
          ],
        },
        undefined
      )

      expect(connection.get).toHaveBeenCalledWith(
        'taskUrl',
        undefined
      )

      expect(instance.value.statusMigrations).toBeUndefined()
    })

    it('should update the id if changed', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          id: '1',
          name: 'name',
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
          issueTypeMappings: {
            1234: 'workflow name',
          },
          statusMigrations: [
            {
              issueTypeId: '1',
              statusId: '2',
              newStatusId: '3',
            },
          ],
        }
      )

      deployChangeMock.mockResolvedValue({ draft: false })

      connection.get.mockResolvedValueOnce({
        status: 404,
        data: {},
      })

      connection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          isLast: true,
          startAt: 0,
          values: [{
            id: '2',
            name: 'name',
          }],
        },
      })

      const instanceBefore = instance.clone()
      instanceBefore.value.description = 'desc'
      await filter.deploy?.([toChange({ before: instanceBefore, after: instance })])


      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({ before: instanceBefore, after: instance }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false })
          .apiDefinitions.types.WorkflowScheme.deployRequests,
        fieldsToIgnore: ['items'],
        elementsSource,
      })


      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/workflowscheme/1',
        undefined
      )

      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/workflowscheme',
        undefined
      )

      expect(instance.value.statusMigrations).toBeUndefined()
      expect(instance.value.id).toBe('2')
    })

    it('should not update the id if not changed', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          id: '1',
          name: 'name',
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
          issueTypeMappings: {
            1234: 'workflow name',
          },
          statusMigrations: [
            {
              issueTypeId: '1',
              statusId: '2',
              newStatusId: '3',
            },
          ],
        }
      )

      deployChangeMock.mockResolvedValue({ draft: false })

      connection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          name: 'name',
        },
      })

      const instanceBefore = instance.clone()
      instanceBefore.value.description = 'desc'
      await filter.deploy?.([toChange({ before: instanceBefore, after: instance })])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({ before: instanceBefore, after: instance }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false })
          .apiDefinitions.types.WorkflowScheme.deployRequests,
        fieldsToIgnore: ['items'],
        elementsSource,
      })

      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/workflowscheme/1',
        undefined
      )

      expect(connection.get).not.toHaveBeenCalledWith(
        '/rest/api/3/workflowscheme',
        undefined
      )

      expect(instance.value.statusMigrations).toBeUndefined()
      expect(instance.value.id).toBe('1')
    })

    it('should not update the id if not found', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          id: '1',
          name: 'name',
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
          issueTypeMappings: {
            1234: 'workflow name',
          },
          statusMigrations: [
            {
              issueTypeId: '1',
              statusId: '2',
              newStatusId: '3',
            },
          ],
        }
      )

      deployChangeMock.mockResolvedValue({ draft: false })

      connection.get.mockResolvedValueOnce({
        status: 404,
        data: {},
      })

      connection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          isLast: true,
          startAt: 0,
          values: [],
        },
      })

      const instanceBefore = instance.clone()
      instanceBefore.value.description = 'desc'
      await filter.deploy?.([toChange({ before: instanceBefore, after: instance })])

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({ before: instanceBefore, after: instance }),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false })
          .apiDefinitions.types.WorkflowScheme.deployRequests,
        fieldsToIgnore: ['items'],
        elementsSource,
      })

      expect(instance.value.statusMigrations).toBeUndefined()
      expect(instance.value.id).toBe('1')
    })

    it('should not return error if publish draft failed', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          id: '1',
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
          issueTypeMappings: {
            1234: 'workflow name',
          },
        }
      )

      deployChangeMock.mockResolvedValue({ draft: true })
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          self: 'taskUrl',
          result: 'done',
          status: 'FAIL',
        },
      })

      const instanceBefore = instance.clone()
      instanceBefore.value.description = 'desc'
      const res = await filter.deploy?.([toChange({ before: instanceBefore, after: instance })])
      expect(res?.deployResult.appliedChanges).toHaveLength(1)
      expect(res?.deployResult.errors).toEqual([])
    })

    it('throw if publish draft did not finish after max tries', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          id: '1',
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
          issueTypeMappings: {
            1234: 'workflow name',
          },
        }
      )

      deployChangeMock.mockResolvedValue({ draft: true })
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          self: 'taskUrl',
        },
      })

      connection.get.mockResolvedValue({
        status: 200,
        data: {
          self: 'taskUrl',
        },
      })

      const instanceBefore = instance.clone()
      instanceBefore.value.description = 'desc'
      const res = await filter.deploy?.([toChange({ before: instanceBefore, after: instance })])

      // + 1 is for the internal id check
      expect(connection.get).toHaveBeenCalledTimes(MAX_TASK_CHECKS + 1)

      expect(res?.deployResult.appliedChanges).toEqual([])
      expect(res?.deployResult.errors).toHaveLength(1)
    })

    it('when response is invalid should return an error', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          id: '1',
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
          issueTypeMappings: {
            1234: 'workflow name',
          },
        }
      )

      deployChangeMock.mockResolvedValue({ draft: true })
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          self: 2,
        },
      })

      const instanceBefore = instance.clone()
      instanceBefore.value.description = 'desc'
      const res = await filter.deploy?.([toChange({ before: instanceBefore, after: instance })])

      expect(res?.deployResult.appliedChanges).toEqual([])
      expect(res?.deployResult.errors).toHaveLength(1)
    })
    it('should reformat the error message when it does not get status migration', async () => {
      const workflowSchemeInstance = new InstanceElement(
        'workflowSchemeInstance',
        workflowSchemeType,
        { workflow: 'workflow name' }
      )
      const issueInstance = new InstanceElement(
        'issueInstance',
        new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_NAME) }),
        { id: '2' }
      )
      const statusFirstInstance = new InstanceElement(
        'statusFirstInstance',
        new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) }),
        { id: '3' }
      )
      const statusSecondInstance = new InstanceElement(
        'statusSecondInstance',
        new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) }),
        { id: '4' }
      )
      elementsSource = buildElementsSourceFromElements(
        [workflowSchemeInstance, statusFirstInstance, statusSecondInstance, issueInstance]
      )
      const { client: cli, paginator, connection: conn } = mockClient()
      client = cli
      connection = conn
      filter = workflowSchemeFilter(getFilterParams({
        client,
        paginator,
        elementsSource,
      }))

      deployChangeMock.mockResolvedValue({ draft: true })
      connection.post.mockImplementation(() => { throw new ServiceError(['Issue type with ID 2 is missing the mappings required for statuses with IDs 3,4']) })

      const instanceBefore = workflowSchemeInstance.clone()
      workflowSchemeInstance.value.workflow = 'other workflow'
      const result = await filter.deploy?.(
        [toChange({ before: instanceBefore, after: workflowSchemeInstance })]
      )
      expect(result).toBeDefined()
      expect(result?.deployResult.appliedChanges).toHaveLength(1)
      expect(result?.deployResult.errors).toEqual([])
      expect(logErrorSpy).toHaveBeenCalledWith('failed to publish draft for workflow scheme workflowSchemeInstance, error: Failed to publish draft with error: . Issue type with name issueInstance is missing the mappings required for statuses with names statusFirstInstance,statusSecondInstance')
    })

    it('should log the same error when the regex is not matched', async () => {
      const workflowSchemeInstance = new InstanceElement(
        'workflowSchemeInstance',
        workflowSchemeType,
        { workflow: 'workflow name' }
      )
      const issueInstance = new InstanceElement(
        'issueInstance',
        new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_NAME) }),
        { id: '2' }
      )
      const statusFirstInstance = new InstanceElement(
        'statusFirstInstance',
        new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) }),
        { id: '3' }
      )
      elementsSource = buildElementsSourceFromElements(
        [workflowSchemeInstance, statusFirstInstance, issueInstance]
      )
      const { client: cli, paginator, connection: conn } = mockClient()
      client = cli
      connection = conn
      filter = workflowSchemeFilter(getFilterParams({
        client,
        paginator,
        elementsSource,
      }))

      deployChangeMock.mockResolvedValue({ draft: true })
      connection.post.mockImplementation(() => { throw new ServiceError(['<not correct message> 2 is missing the mappings required for statuses <not correct message> with 3']) })

      const instanceBefore = workflowSchemeInstance.clone()
      workflowSchemeInstance.value.workflow = 'other workflow'
      const result = await filter.deploy?.(
        [toChange({ before: instanceBefore, after: workflowSchemeInstance })]
      )
      expect(result).toBeDefined()
      expect(result?.deployResult.appliedChanges).toHaveLength(1)
      expect(result?.deployResult.errors).toEqual([])
      expect(logErrorSpy).toHaveBeenCalledWith('failed to publish draft for workflow scheme workflowSchemeInstance, error: Failed to publish draft with error: . <not correct message> 2 is missing the mappings required for statuses <not correct message> with 3')
    })

    it('should partly edit the error message when an ID is not in the elementsSource', async () => {
      const workflowSchemeInstance = new InstanceElement(
        'workflowSchemeInstance',
        workflowSchemeType,
        { workflow: 'workflow name' }
      )
      const issueInstance = new InstanceElement(
        'issueInstance',
        new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_NAME) }),
        { id: '2' }
      )
      elementsSource = buildElementsSourceFromElements(
        [workflowSchemeInstance, issueInstance]
      )
      const { client: cli, paginator, connection: conn } = mockClient()
      client = cli
      connection = conn
      filter = workflowSchemeFilter(getFilterParams({
        client,
        paginator,
        elementsSource,
      }))

      deployChangeMock.mockResolvedValue({ draft: true })
      connection.post.mockImplementation(() => { throw new ServiceError(['Issue type with ID 2 is missing the mappings required for statuses with IDs 7']) })

      const instanceBefore = workflowSchemeInstance.clone()
      workflowSchemeInstance.value.workflow = 'other workflow'
      const result = await filter.deploy?.(
        [toChange({ before: instanceBefore, after: workflowSchemeInstance })]
      )
      expect(result).toBeDefined()
      expect(result?.deployResult.appliedChanges).toHaveLength(1)
      expect(result?.deployResult.errors).toEqual([])
      expect(logErrorSpy).toHaveBeenCalledWith('failed to publish draft for workflow scheme workflowSchemeInstance, error: Failed to publish draft with error: . Issue type with name issueInstance is missing the mappings required for statuses with names ID 7')
    })
  })

  describe('onDeploy', () => {
    it('should remove issueTypeMappings', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
          issueTypeMappings: {
            1234: 'workflow name',
          },
        }
      )
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        items: [
          {
            issueType: 1234,
            workflow: 'workflow name',
          },
        ],
      })
    })

    it('should remove updateDraftIfNeeded', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          updateDraftIfNeeded: true,
        }
      )
      await filter.onDeploy?.([toChange({ before: instance, after: instance })])
      expect(instance.value).toEqual({})
    })
  })
})
