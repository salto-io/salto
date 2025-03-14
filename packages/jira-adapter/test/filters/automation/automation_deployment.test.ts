/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ElemID,
  InstanceElement,
  ObjectType,
  CORE_ANNOTATIONS,
  BuiltinTypes,
  Values,
  toChange,
  Value,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import automationDeploymentFilter from '../../../src/filters/automation/automation_deployment'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { AUTOMATION_TYPE, JIRA, OBJECT_SCHEMA_TYPE, OBJECT_TYPE_TYPE, REQUEST_TYPE_NAME } from '../../../src/constants'
import { PRIVATE_API_HEADERS } from '../../../src/client/headers'
import JiraClient from '../../../src/client/client'

describe('automationDeploymentFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>
  let type: ObjectType
  let instance: InstanceElement
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let deploymentTriggerSegment: Value
  const objectSchemaType = new ObjectType({
    elemID: new ElemID(JIRA, OBJECT_SCHEMA_TYPE),
    fields: {
      name: {
        refType: BuiltinTypes.STRING,
      },
      id: {
        refType: BuiltinTypes.STRING,
      },
      workspaceId: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const objectTypeType = new ObjectType({
    elemID: new ElemID(JIRA, OBJECT_TYPE_TYPE),
    fields: {
      name: {
        refType: BuiltinTypes.STRING,
      },
      id: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const requestTypeType = new ObjectType({
    elemID: new ElemID(JIRA, REQUEST_TYPE_NAME),
    fields: {
      name: {
        refType: BuiltinTypes.STRING,
      },
      id: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const objectSchemaInstance = new InstanceElement('instance', objectSchemaType, {
    name: 'schemaName',
    id: '25',
    workspaceId: 'w11',
  })
  const objectTypeInstance = new InstanceElement(
    'instance',
    objectTypeType,
    {
      name: 'objectTypeName',
      id: '35',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance)],
    },
  )
  const requestTypeInstance = new InstanceElement('instance', requestTypeType, {
    name: 'requestTypeName',
    id: '45',
    serviceDeskId: '55',
  })
  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient(false)
    client = cli
    connection = conn

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = automationDeploymentFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>

    type = new ObjectType({
      elemID: new ElemID(JIRA, AUTOMATION_TYPE),
      fields: {
        name: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    instance = new InstanceElement('instance', type, {
      name: 'someName',
      state: 'ENABLED',
      trigger: {
        component: 'ACTION',
        schemaVersion: 1,
        value: {
          objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
          schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
        },
        children: [],
        conditions: [],
      },
      projects: [
        {
          projectId: '1',
        },
      ],
    })
    deploymentTriggerSegment = {
      trigger: {
        component: 'ACTION',
        schemaVersion: 1,
        value: {
          objectTypeId: {
            id: '35',
            name: 'objectTypeName',
          },
          schemaId: {
            id: '25',
            name: 'schemaName',
            workspaceId: 'w11',
          },
        },
        children: [],
        conditions: [],
      },
    }
  })

  describe('onFetch', () => {
    it('should add deployment annotations', async () => {
      await filter.onFetch([type])

      expect(type.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.DELETABLE]: true,
      })

      expect(type.fields.name.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should not add deployment annotations if usePrivateAPI is false', async () => {
      config.client.usePrivateAPI = false

      await filter.onFetch([type])

      expect(type.annotations).toEqual({})
      expect(type.fields.name.annotations).toEqual({})
    })

    it('should not add deployment annotations if type not found', async () => {
      await filter.onFetch([])
      expect(type.annotations).toEqual({})
      expect(type.fields.name.annotations).toEqual({})
    })
  })

  describe('deploy', () => {
    let existingAutomationValues: Values
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const createPostMockResponse = (projects: Value) =>
      jest.fn((url: string): Value => {
        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/import') {
          return {
            status: 200,
            data: {
              id: 'AA',
            },
          }
        }
        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules') {
          return {
            status: 200,
            data: {
              total: 2,
              values: [
                existingAutomationValues,
                {
                  name: 'someName',
                  id: 3,
                  created: 1,
                  projects,
                },
              ],
            },
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })

    beforeEach(() => {
      existingAutomationValues = {
        name: 'existingAutomation',
        id: 2,
        created: 2,
        projects: [],
      }

      connection.post.mockImplementation(async url => createPostMockResponse([{ projectId: '1' }])(url))
    })

    it('should create automation', async () => {
      await filter.deploy([toChange({ after: instance })])

      expect(instance.value.id).toBe(3)
      expect(instance.value.created).toBe(1)

      deploymentTriggerSegment.trigger.value.eventFilters = ['ari:cloud:jira:cloudId:project/1']
      expect(connection.post).toHaveBeenCalledWith(
        '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/import',
        {
          rules: [
            {
              ...deploymentTriggerSegment,
              name: 'someName',
              state: 'ENABLED',
              projects: [
                {
                  projectId: '1',
                },
              ],
              ruleScope: {
                resources: ['ari:cloud:jira:cloudId:project/1'],
              },
            },
          ],
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
      deploymentTriggerSegment.trigger.value.eventFilters = ['ari:cloud:jira:cloudId:project/1']
      expect(connection.put).toHaveBeenCalledWith(
        '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/3',
        {
          ruleConfigBean: {
            id: 3,
            created: 1,
            name: 'someName',
            state: 'ENABLED',
            ...deploymentTriggerSegment,
            projects: [
              {
                projectId: '1',
              },
            ],
            ruleScope: {
              resources: ['ari:cloud:jira:cloudId:project/1'],
            },
          },
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })

    it('should create automation with unsorted many projects', async () => {
      connection.post.mockImplementation(async url =>
        createPostMockResponse([
          {
            projectId: '1',
          },
          {
            projectId: '3',
          },
          {
            projectId: '2',
          },
        ])(url),
      )

      instance.value.projects = [
        {
          projectId: '3',
        },
        {
          projectId: '1',
        },
        {
          projectId: '2',
        },
      ]
      await filter.deploy([toChange({ after: instance })])

      expect(instance.value.id).toBe(3)
      expect(instance.value.created).toBe(1)
    })

    describe('retries', () => {
      beforeEach(() => {
        const { client: cli, paginator, connection: conn } = mockClient(false)
        client = cli
        connection = conn
        config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.deploy.taskMaxRetries = 3
        config.deploy.taskRetryDelay = 1
        filter = automationDeploymentFilter(
          getFilterParams({
            client,
            paginator,
            config,
          }),
        ) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>
        connection.post.mockImplementation(async url => createPostMockResponse([{ projectId: '1' }])(url))
      })
      it('should wait for a success answer from import', async () => {
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            taskState: 'PENDING',
          },
        })
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            taskState: 'PENDING',
          },
        })
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            taskState: 'SUCCESS',
          },
        })
        await filter.deploy([toChange({ after: instance })])
        expect(connection.get).toHaveBeenCalledWith(
          '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/task/AA/progress',
          expect.anything(),
        )
        expect(connection.get).toHaveBeenCalledTimes(3)
        expect(instance.value.id).toBe(3)
        expect(instance.value.created).toBe(1)
      })
      it('should not fail if max retires was hit', async () => {
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            taskState: 'PENDING',
          },
        })
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            taskState: 'PENDING',
          },
        })
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            taskState: 'PENDING',
          },
        })
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            taskState: 'PENDING',
          },
        })
        await filter.deploy([toChange({ after: instance })])
        expect(connection.get).toHaveBeenCalledWith(
          '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/task/AA/progress',
          expect.anything(),
        )
        expect(connection.get).toHaveBeenCalledTimes(4)
        expect(instance.value.id).toBe(3)
        expect(instance.value.created).toBe(1)
      })
    })

    it('should create automation in jira DC', async () => {
      const { client: cli, connection: conn } = mockClient(true)
      client = cli
      connection = conn

      connection.post.mockImplementation(async url => {
        if (url === '/rest/cb-automation/latest/project/GLOBAL/rule/import') {
          return {
            status: 200,
            data: null,
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })

      connection.get.mockImplementation(async url => {
        if (url === '/rest/cb-automation/latest/project/GLOBAL/rule') {
          return {
            status: 200,
            data: [
              existingAutomationValues,
              {
                name: 'someName',
                id: 3,
                created: 1,
                projects: [
                  {
                    projectId: '1',
                  },
                ],
              },
            ],
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })

      filter = automationDeploymentFilter(
        getFilterParams({
          client,
        }),
      ) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>

      await filter.deploy([toChange({ after: instance })])

      expect(instance.value.id).toBe(3)
      expect(instance.value.created).toBe(1)

      expect(connection.post).toHaveBeenCalledWith(
        '/rest/cb-automation/latest/project/GLOBAL/rule/import',
        {
          rules: [
            {
              name: 'someName',
              state: 'ENABLED',
              ...deploymentTriggerSegment,
              projects: [
                {
                  projectId: '1',
                },
              ],
            },
          ],
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )

      expect(connection.put).toHaveBeenCalledWith(
        '/rest/cb-automation/latest/project/GLOBAL/rule/3',
        {
          id: 3,
          created: 1,
          name: 'someName',
          state: 'ENABLED',
          ...deploymentTriggerSegment,
          projects: [
            {
              projectId: '1',
            },
          ],
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })

    it('should not call enable automation if it is disabled', async () => {
      instance.value.state = 'DISABLED'
      await filter.deploy([toChange({ after: instance })])

      expect(instance.value.id).toBe(3)
      deploymentTriggerSegment.trigger.value.eventFilters = ['ari:cloud:jira:cloudId:project/1']
      expect(connection.post).toHaveBeenCalledWith(
        '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/import',
        {
          rules: [
            {
              name: 'someName',
              state: 'DISABLED',
              ...deploymentTriggerSegment,
              projects: [
                {
                  projectId: '1',
                },
              ],
              ruleScope: {
                resources: ['ari:cloud:jira:cloudId:project/1'],
              },
            },
          ],
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )

      expect(connection.put).not.toHaveBeenCalled()
    })

    it('should throw with the right explanation whan fail to update automation state', async () => {
      connection.put.mockImplementation(async url => {
        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/3') {
          throw new Error('update automation state failed')
        }
        throw new Error(`Unexpected url ${url}`)
      })

      const { deployResult } = await filter.deploy([toChange({ after: instance })])

      expect(deployResult.errors).toHaveLength(1)
      expect(deployResult.errors[0].message).toContain('update automation state failed')
    })

    it('should deploy automation of all projects', async () => {
      delete instance.value.projects
      connection.post.mockClear()
      connection.post.mockImplementation(async url => createPostMockResponse([])(url))
      await filter.deploy([toChange({ after: instance })])
      deploymentTriggerSegment.trigger.value.eventFilters = ['ari:cloud:jira::site/cloudId']
      expect(connection.post).toHaveBeenCalledWith(
        '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/import',
        {
          rules: [
            {
              name: 'someName',
              state: 'ENABLED',
              ...deploymentTriggerSegment,
              ruleScope: {
                resources: ['ari:cloud:jira::site/cloudId'],
              },
            },
          ],
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })

    it('should deploy automation of projects type', async () => {
      instance.value.projects = [
        {
          projectTypeKey: 'business',
        },
      ]
      connection.post.mockClear()
      connection.post.mockImplementation(async url =>
        createPostMockResponse([
          {
            projectTypeKey: 'business',
          },
        ])(url),
      )
      await filter.deploy([toChange({ after: instance })])
      deploymentTriggerSegment.trigger.value.eventFilters = ['ari:cloud:jira-core::site/cloudId']
      expect(connection.post).toHaveBeenCalledWith(
        '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/import',
        {
          rules: [
            {
              name: 'someName',
              state: 'ENABLED',
              ...deploymentTriggerSegment,
              projects: [
                {
                  projectTypeKey: 'business',
                },
              ],
              ruleScope: {
                resources: ['ari:cloud:jira-core::site/cloudId'],
              },
            },
          ],
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })

    it('should throw if received invalid response from import', async () => {
      connection.post.mockImplementation(async url => {
        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/import') {
          return {
            status: 200,
            data: [existingAutomationValues, {}],
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })
      const { deployResult } = await filter.deploy([toChange({ after: instance })])
      expect(deployResult.errors).toHaveLength(1)
    })

    it('should throw if received more than one identical automation in response', async () => {
      connection.post.mockImplementation(async url => {
        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/import') {
          return {
            status: 200,
            data: [
              existingAutomationValues,
              {
                name: 'someName',
                id: 3,
                created: 1,
                projects: [
                  {
                    projectId: '1',
                  },
                ],
              },
              {
                name: 'someName',
                id: 4,
                created: 1,
                projects: [
                  {
                    projectId: '1',
                  },
                ],
              },
            ],
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })
      const { deployResult } = await filter.deploy([toChange({ after: instance })])
      expect(deployResult.errors).toHaveLength(1)
    })

    it('should delete automation', async () => {
      instance.value.id = 3
      await filter.deploy([toChange({ before: instance })])

      expect(connection.delete).toHaveBeenCalledWith(
        '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/3',
        {
          headers: {
            ...PRIVATE_API_HEADERS,
            'Content-Type': 'application/json',
          },
        },
      )
    })

    it('should delete automation in jira DC', async () => {
      const { client: cli, connection: conn } = mockClient(true)
      client = cli
      connection = conn

      filter = automationDeploymentFilter(
        getFilterParams({
          client,
        }),
      ) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>

      instance.value.id = 3
      await filter.deploy([toChange({ before: instance })])

      expect(connection.delete).toHaveBeenCalledWith('/rest/cb-automation/latest/project/GLOBAL/rule/3', {
        headers: {
          ...PRIVATE_API_HEADERS,
          'Content-Type': 'application/json',
        },
      })
    })

    it('should modify automation', async () => {
      instance.value.id = 3
      instance.value.created = 1
      await filter.deploy([toChange({ before: instance, after: instance })])
      deploymentTriggerSegment.trigger.value.eventFilters = ['ari:cloud:jira:cloudId:project/1']
      expect(connection.put).toHaveBeenCalledWith(
        '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/3',
        {
          ruleConfigBean: {
            id: 3,
            created: 1,
            name: 'someName',
            state: 'ENABLED',
            ...deploymentTriggerSegment,
            projects: [
              {
                projectId: '1',
              },
            ],
            ruleScope: {
              resources: ['ari:cloud:jira:cloudId:project/1'],
            },
          },
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })
    describe('automation label', () => {
      beforeEach(() => {
        instance.value.id = 555
        connection.put.mockImplementation(async url => {
          if (
            url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules/555/labels/1' ||
            url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules/555/labels/2' ||
            url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule/555'
          ) {
            return {
              status: 200,
              data: null,
            }
          }
          throw new Error(`Unexpected url ${url}`)
        })
      })
      it('should add a label to automation', async () => {
        const modifyInstance = instance.clone()
        modifyInstance.value.labels = ['1']
        await filter.deploy([toChange({ before: instance, after: modifyInstance })])
        expect(connection.put).toHaveBeenCalledTimes(2)
        expect(connection.put).toHaveBeenCalledWith(
          '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules/555/labels/1',
          null,
          { headers: { 'Content-Type': 'application/json' } },
        )
      })

      it('should add a label to automation in jira DC', async () => {
        const { client: cli, connection: conn } = mockClient(true)
        client = cli
        connection = conn

        filter = automationDeploymentFilter(
          getFilterParams({
            client,
          }),
        ) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>

        const modifyInstance = instance.clone()
        modifyInstance.value.labels = ['1']
        await filter.deploy([toChange({ before: instance, after: modifyInstance })])
        expect(connection.put).toHaveBeenCalledTimes(2)
        expect(connection.put).toHaveBeenCalledWith(
          '/rest/cb-automation/latest/project/GLOBAL/rule/555/label/1',
          null,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      })

      it('should delete an automation label', async () => {
        const modifyInstance = instance.clone()
        instance.value.labels = ['1']
        await filter.deploy([toChange({ before: instance, after: modifyInstance })])
        expect(connection.delete).toHaveBeenCalledWith(
          '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules/555/labels/1',
          {
            headers: { 'Content-Type': 'application/json' },
          },
        )
      })

      it('should delete an automation label in jira DC', async () => {
        const { client: cli, connection: conn } = mockClient(true)
        client = cli
        connection = conn

        filter = automationDeploymentFilter(
          getFilterParams({
            client,
          }),
        ) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>

        const modifyInstance = instance.clone()
        instance.value.labels = ['1']
        await filter.deploy([toChange({ before: instance, after: modifyInstance })])
        expect(connection.delete).toHaveBeenCalledWith('/rest/cb-automation/latest/project/GLOBAL/rule/555/label/1', {
          headers: { 'Content-Type': 'application/json' },
        })
      })

      it('should modify an automation label', async () => {
        instance.value.labels = ['1']
        const modifyInstance = instance.clone()
        modifyInstance.value.labels = ['2']
        await filter.deploy([toChange({ before: instance, after: modifyInstance })])
        expect(connection.put).toHaveBeenCalledWith(
          '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules/555/labels/2',
          null,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
        expect(connection.delete).toHaveBeenCalledWith(
          '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules/555/labels/1',
          {
            headers: { 'Content-Type': 'application/json' },
          },
        )
      })
    })
    describe('preDeploy', () => {
      describe('assets components', () => {
        let automationInstance: InstanceElement
        beforeEach(() => {
          automationInstance = new InstanceElement('instance', type, {
            name: 'someName',
            state: 'ENABLED',
            projects: [],
            trigger: {
              component: 'ACTION',
              schemaVersion: 1,
              value: {
                objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
                schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
              },
              children: [],
              conditions: [],
            },
            components: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                value: {
                  objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
                  schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
                },
                children: [
                  {
                    component: 'ACTION',
                    schemaVersion: 1,
                    value: {
                      objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
                      schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
                    },
                    children: [],
                    conditions: [],
                  },
                ],
                conditions: [],
              },
            ],
          })
        })
        it('should add missing fields to assets components when enable JSM is true', async () => {
          config.fetch.enableJSM = true
          config.fetch.enableJSMPremium = true
          await filter.preDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0]).toEqual({
            component: 'ACTION',
            schemaVersion: 1,
            value: {
              objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
              schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
              schemaLabel: 'schemaName',
              objectTypeLabel: 'objectTypeName',
              workspaceId: 'w11',
            },
            children: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                value: {
                  objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
                  schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
                  schemaLabel: 'schemaName',
                  objectTypeLabel: 'objectTypeName',
                  workspaceId: 'w11',
                },
                children: [],
                conditions: [],
              },
            ],
            conditions: [],
          })
          expect(automationInstance.value.trigger).toEqual({
            component: 'ACTION',
            schemaVersion: 1,
            value: {
              objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
              schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
              schemaLabel: 'schemaName',
              objectTypeLabel: 'objectTypeName',
              workspaceId: 'w11',
            },
            children: [],
            conditions: [],
          })
        })
        it('should modify only assets components when enable JSM is true', async () => {
          config.fetch.enableJSM = true
          config.fetch.enableJSMPremium = true
          automationInstance.value.components.push({
            component: 'ACTION',
            schemaVersion: 1,
            value: {
              attribute: 'value',
            },
            children: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                value: {
                  objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
                  schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
                },
                children: [],
                conditions: [],
              },
            ],
            conditions: [],
          })
          await filter.preDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0].value).toEqual({
            objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
            schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
            schemaLabel: 'schemaName',
            objectTypeLabel: 'objectTypeName',
            workspaceId: 'w11',
          })
          expect(automationInstance.value.components[1]).toEqual({
            component: 'ACTION',
            schemaVersion: 1,
            value: {
              attribute: 'value',
            },
            children: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                value: {
                  objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
                  schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
                  schemaLabel: 'schemaName',
                  objectTypeLabel: 'objectTypeName',
                  workspaceId: 'w11',
                },
                children: [],
                conditions: [],
              },
            ],
            conditions: [],
          })
        })
        it('should not add missing fields to assets components when enable JSM is false', async () => {
          config.fetch.enableJSM = false
          config.fetch.enableJSMPremium = false
          await filter.preDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0].value).toEqual({
            objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
            schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
          })
        })
        it('should do nothing if there are no components', async () => {
          automationInstance.value.components.value = undefined
          config.fetch.enableJSM = true
          config.fetch.enableJSMPremium = true
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components.value).toBeUndefined()
        })
        it('should do nothing if the component is not assets component', async () => {
          automationInstance.value.components = undefined
          config.fetch.enableJSM = true
          config.fetch.enableJSMPremium = true
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components).toBeUndefined()
        })
      })
      describe('requestType components', () => {
        let automationInstance: InstanceElement
        beforeEach(() => {
          automationInstance = new InstanceElement('instance', type, {
            name: 'someName',
            state: 'ENABLED',
            projects: [],
            components: [
              {
                component: 'ACTION',
                schemaVersion: 10,
                value: {
                  requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
                },
                children: [
                  {
                    component: 'ACTION',
                    schemaVersion: 10,
                    value: {
                      requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
                    },
                    children: [],
                    conditions: [],
                  },
                ],
                conditions: [],
              },
            ],
          })
        })
        it('should add missing fields to requestType components when enable JSM is true', async () => {
          config.fetch.enableJSM = true
          await filter.preDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0]).toEqual({
            component: 'ACTION',
            schemaVersion: 10,
            value: {
              requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
              serviceDesk: '55',
            },
            children: [
              {
                component: 'ACTION',
                schemaVersion: 10,
                value: {
                  requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
                  serviceDesk: '55',
                },
                children: [],
                conditions: [],
              },
            ],
            conditions: [],
          })
        })
        it('should modify only requestType components when enable JSM is true', async () => {
          config.fetch.enableJSM = true
          automationInstance.value.components.push({
            component: 'ACTION',
            schemaVersion: 1,
            value: {
              attribute: 'value',
            },
            children: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                value: {
                  requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
                },
                children: [],
                conditions: [],
              },
            ],
          })
          await filter.preDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0].value).toEqual({
            requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
            serviceDesk: '55',
          })
          expect(automationInstance.value.components[1]).toEqual({
            component: 'ACTION',
            schemaVersion: 1,
            value: {
              attribute: 'value',
            },
            children: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                value: {
                  requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
                  serviceDesk: '55',
                },
                children: [],
                conditions: [],
              },
            ],
          })
        })
        it('should not add missing fields to requestType components when enable JSM is false', async () => {
          config.fetch.enableJSM = false
          await filter.preDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0].value).toEqual({
            requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
          })
        })
        it('should do nothing if there are no components', async () => {
          automationInstance.value.components.value = undefined
          config.fetch.enableJSM = true
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components.value).toBeUndefined()
        })
        it('should do nothing if the component is not requestType component', async () => {
          automationInstance.value.components = undefined
          config.fetch.enableJSM = true
          config.fetch.enableJSMPremium = true
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components).toBeUndefined()
        })
      })
    })
    describe('onDeploy', () => {
      describe('assets components', () => {
        let automationInstance: InstanceElement
        beforeEach(() => {
          automationInstance = new InstanceElement('instance', type, {
            name: 'someName',
            state: 'ENABLED',
            projects: [],
            trigger: {
              component: 'ACTION',
              schemaVersion: 1,
              value: {
                objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
                workspaceId: 'w11',
                schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
                schemaLabel: 'schemaName',
                objectTypeLabel: 'objectTypeName',
              },
              children: [],
              conditions: [],
            },
            components: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                value: {
                  objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
                  workspaceId: 'w11',
                  schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
                  schemaLabel: 'schemaName',
                  objectTypeLabel: 'objectTypeName',
                },
                children: [
                  {
                    component: 'ACTION',
                    schemaVersion: 1,
                    value: {
                      objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
                      workspaceId: 'w11',
                      schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
                      schemaLabel: 'schemaName',
                      objectTypeLabel: 'objectTypeName',
                    },
                    children: [],
                    conditions: [],
                  },
                ],
                conditions: [],
              },
            ],
          })
        })
        it('should remove extra fields for assets components when enable JSM is true', async () => {
          config.fetch.enableJSM = true
          config.fetch.enableJSMPremium = true
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0]).toEqual({
            component: 'ACTION',
            schemaVersion: 1,
            value: {
              objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
              schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
            },
            children: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                value: {
                  objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
                  schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
                },
                children: [],
                conditions: [],
              },
            ],
            conditions: [],
          })
          expect(automationInstance.value.trigger).toEqual({
            component: 'ACTION',
            schemaVersion: 1,
            value: {
              objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
              schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
            },
            children: [],
            conditions: [],
          })
        })
        it('should not remove missing fields to assets components when enable JSM is false', async () => {
          config.fetch.enableJSM = false
          config.fetch.enableJSMPremium = false
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0].value).toEqual({
            objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
            workspaceId: 'w11',
            schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
            schemaLabel: 'schemaName',
            objectTypeLabel: 'objectTypeName',
          })
        })
        it('should do nothing if there are no components', async () => {
          automationInstance.value.components = undefined
          config.fetch.enableJSM = true
          config.fetch.enableJSMPremium = true
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components).toBeUndefined()
        })
        it('should modify only assets components when enable JSM is true', async () => {
          config.fetch.enableJSM = true
          config.fetch.enableJSMPremium = true
          automationInstance.value.components.push({
            component: 'ACTION',
            schemaVersion: 1,
            value: {
              attribute: 'value',
            },
          })
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0].value).toEqual({
            objectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
            schemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
          })
          expect(automationInstance.value.components[1].value).toEqual({
            attribute: 'value',
          })
        })
      })
      describe('requestType components', () => {
        let automationInstance: InstanceElement
        beforeEach(() => {
          automationInstance = new InstanceElement('instance', type, {
            name: 'someName',
            state: 'ENABLED',
            projects: [],
            components: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                value: {
                  requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
                  serviceDesk: '55',
                },
                children: [],
                conditions: [],
              },
            ],
          })
        })
        it('should remove extra fields for requestType components when enable JSM is true', async () => {
          config.fetch.enableJSM = true
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0].value).toEqual({
            requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
          })
        })
        it('should not remove missing fields to requestType components when enable JSM is false', async () => {
          config.fetch.enableJSM = false
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0].value).toEqual({
            requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
            serviceDesk: '55',
          })
        })
        it('should do nothing if there are no components', async () => {
          automationInstance.value.components = undefined
          config.fetch.enableJSM = true
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components).toBeUndefined()
        })
        it('should modify only requestType components when enable JSM is true', async () => {
          config.fetch.enableJSM = true
          automationInstance.value.components.push({
            component: 'ACTION',
            schemaVersion: 1,
            value: {
              attribute: 'value',
            },
            children: [],
            conditions: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                value: {
                  requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
                  serviceDesk: '55',
                },
                children: [],
                conditions: [],
              },
            ],
          })
          await filter.onDeploy([toChange({ after: automationInstance })])
          expect(automationInstance.value.components[0].value).toEqual({
            requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
          })
          expect(automationInstance.value.components[1]).toEqual({
            component: 'ACTION',
            schemaVersion: 1,
            value: {
              attribute: 'value',
            },
            children: [],
            conditions: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                value: {
                  requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
                },
                children: [],
                conditions: [],
              },
            ],
          })
        })
      })
    })
  })
})
