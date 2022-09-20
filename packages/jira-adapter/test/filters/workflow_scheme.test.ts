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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { deployment, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { JIRA } from '../../src/constants'
import { getFilterParams, mockClient } from '../utils'
import workflowSchemeFilter, { MAX_TASK_CHECKS } from '../../src/filters/workflow_scheme'
import { Filter } from '../../src/filter'
import { getDefaultConfig } from '../../src/config/config'
import JiraClient from '../../src/client/client'

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

describe('workflowScheme', () => {
  let workflowSchemeType: ObjectType
  let filter: Filter
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn

    filter = workflowSchemeFilter(getFilterParams({
      client,
      paginator,
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
      })
    })

    it('should do nothing if there are no items', async () => {
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
      })

      expect(instance.value.statusMigrations).toBeUndefined()
      expect(instance.value.id).toBe('1')
    })

    it('when return error if publish draft failed', async () => {
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
      expect(res?.deployResult.appliedChanges).toEqual([])
      expect(res?.deployResult.errors).toHaveLength(1)
    })

    it('when throw if publish draft did not finish after max tries', async () => {
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
