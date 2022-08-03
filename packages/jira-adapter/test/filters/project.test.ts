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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils, deployment, elements as elementUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { getDefaultConfig } from '../../src/config/config'
import JiraClient from '../../src/client/client'
import { JIRA } from '../../src/constants'
import projectFilter from '../../src/filters/project'
import { mockClient } from '../utils'

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

describe('projectFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy' | 'onDeploy'>
  let instance: InstanceElement
  let client: JiraClient
  let type: ObjectType
  let connection: MockInterface<clientUtils.APIConnection>
  const deployChangeMock = deployment.deployChange as jest.MockedFunction<
    typeof deployment.deployChange
  >

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn

    deployChangeMock.mockClear()

    filter = projectFilter({
      client,
      paginator,
      config: getDefaultConfig({ isDataCenter: false }),
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as typeof filter

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'Project'),
      fields: {
        workflowScheme: { refType: BuiltinTypes.STRING },
        issueTypeScreenScheme: { refType: BuiltinTypes.STRING },
        fieldConfigurationScheme: { refType: BuiltinTypes.STRING },
        issueTypeScheme: { refType: BuiltinTypes.STRING },
        components: { refType: BuiltinTypes.STRING },
      },
    })

    instance = new InstanceElement(
      'instance',
      type,
    )
  })

  describe('onFetch', () => {
    beforeEach(async () => {
      instance.value = {
        lead: {
          accountId: '1',
        },
        workflowScheme: {
          workflowScheme: {
            id: 2,
          },
        },
        issueTypeScreenScheme: {
          issueTypeScreenScheme: {
            id: '3',
          },
        },
        fieldConfigurationScheme: {
          fieldConfigurationScheme: {
            id: '4',
          },
        },
        notificationScheme: {
          id: 5,
        },
        permissionScheme: {
          id: 6,
        },
        issueTypeScheme: {
          issueTypeScheme: {
            id: '7',
          },
        },
        issueSecurityScheme: {
          id: '8',
        },
      }
      await filter.onFetch([type, instance])
    })

    it('should add the deployment annotations to the schemes', () => {
      expect(type.fields.workflowScheme.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
      expect(type.fields.issueTypeScreenScheme.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
      expect(type.fields.fieldConfigurationScheme.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
      expect(type.fields.issueTypeScheme.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should add the deployment annotations to the components', () => {
      expect(type.fields.components.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should set the leadAccountId', async () => {
      expect(instance.value.leadAccountId).toEqual('1')
    })

    it('should set the schemas ids', async () => {
      expect(instance.value.workflowScheme).toEqual('2')
      expect(instance.value.issueTypeScreenScheme).toEqual('3')
      expect(instance.value.fieldConfigurationScheme).toEqual('4')
      expect(instance.value.notificationScheme).toEqual('5')
      expect(instance.value.permissionScheme).toEqual('6')
      expect(instance.value.issueTypeScheme).toEqual('7')
      expect(instance.value.issueSecurityScheme).toEqual('8')
    })

    it('For impartial instance should set undefined', async () => {
      instance.value = {
      }
      await filter.onFetch([instance])
      expect(instance.value).toEqual({})
    })
  })

  describe('When deploying a modification change', () => {
    let change: Change

    beforeEach(async () => {
      const afterInstance = instance.clone()
      afterInstance.value.workflowScheme = 1
      afterInstance.value.id = 2

      change = toChange({ before: instance, after: afterInstance })

      await filter.deploy([change])
    })
    it('should call deployChange and ignore scheme', () => {
      expect(deployChangeMock).toHaveBeenCalledWith(
        change,
        client,
        getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Project.deployRequests,
        ['components', 'workflowScheme', 'issueTypeScreenScheme', 'fieldConfigurationScheme', 'issueTypeScheme'],
        undefined,
        undefined,
      )
    })

    it('should call the endpoint to set the scheme', () => {
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/api/3/workflowscheme/project',
        {
          workflowSchemeId: 1,
          projectId: 2,
        },
        undefined,
      )
    })
  })

  describe('When deploying an addition change', () => {
    let change: Change

    beforeEach(async () => {
      instance.value.id = 3
      change = toChange({ after: instance })

      connection.get.mockResolvedValue({
        status: 200,
        data: {
          components: [
            {
              id: '1',
            },
            {
              id: '2',
            },
          ],
        },
      })

      await filter.deploy([change])
    })
    it('should call deployChange and ignore the right fields', () => {
      expect(deployChangeMock).toHaveBeenCalledWith(
        change,
        client,
        getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Project.deployRequests,
        ['components', 'fieldConfigurationScheme'],
        undefined,
        undefined,
      )
    })

    it('should call the endpoint to get the components', () => {
      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/project/3',
        undefined,
      )
    })

    it('should call the endpoint to remove the components', () => {
      expect(connection.delete).toHaveBeenCalledWith(
        '/rest/api/3/component/1',
        undefined,
      )

      expect(connection.delete).toHaveBeenCalledWith(
        '/rest/api/3/component/2',
        undefined,
      )
    })
  })

  describe('When deploying an addition change with 500 error', () => {
    let change: Change

    beforeEach(async () => {
      deployChangeMock.mockRejectedValue({
        response: {
          status: 500,
        },
      })

      instance.value.id = '3'
      instance.value.key = 'key'
      change = toChange({ after: instance })

      connection.get.mockImplementation(async url => {
        if (url.includes('/rest/api/3/project')) {
          return {
            status: 200,
            data: {
              id: '3',
              components: [
                {
                  id: '1',
                },
                {
                  id: '2',
                },
              ],
            },
          }
        }

        if (url.includes('/rest/api/3/fieldconfigurationscheme/')) {
          return {
            status: 200,
            data: {
              values: [{
                fieldConfigurationScheme: {
                  id: '4',
                },
              }],
            },
          }
        }

        throw new Error('Unexpected url')
      })

      await filter.deploy([change])
    })
    it('should call deployChange and ignore the right fields', () => {
      expect(deployChangeMock).toHaveBeenCalledWith(
        change,
        client,
        getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Project.deployRequests,
        ['components', 'fieldConfigurationScheme'],
        undefined,
        undefined,
      )
    })

    it('should call the endpoint to get the projectId', () => {
      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/project/key',
        undefined,
      )
    })

    it('should call the endpoint to get the fieldConfigurationScheme', () => {
      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/fieldconfigurationscheme/project?projectId=3',
        undefined,
      )
    })

    it('should call the endpoint to delete the fieldConfigurationScheme', () => {
      expect(connection.delete).toHaveBeenCalledWith(
        '/rest/api/3/fieldconfigurationscheme/4',
        undefined,
      )
    })

    it('should call the endpoint to get the components', () => {
      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/project/3',
        undefined,
      )
    })

    it('should call the endpoint to remove the components', () => {
      expect(connection.delete).toHaveBeenCalledWith(
        '/rest/api/3/component/1',
        undefined,
      )

      expect(connection.delete).toHaveBeenCalledWith(
        '/rest/api/3/component/2',
        undefined,
      )
    })
  })

  describe('When deploying an addition change with 500 error and field configuration was already deleted', () => {
    let change: Change

    beforeEach(async () => {
      deployChangeMock.mockRejectedValue({
        response: {
          status: 500,
        },
      })

      instance.value.id = '3'
      instance.value.key = 'key'
      change = toChange({ after: instance })

      connection.get.mockImplementation(async url => {
        if (url.includes('/rest/api/3/project')) {
          return {
            status: 200,
            data: {
              id: '3',
              components: [
                {
                  id: '1',
                },
                {
                  id: '2',
                },
              ],
            },
          }
        }

        if (url.includes('/rest/api/3/fieldconfigurationscheme/')) {
          return {
            status: 200,
            data: {
              values: [{
              }],
            },
          }
        }

        throw new Error('Unexpected url')
      })

      await filter.deploy([change])
    })
    it('should call deployChange and ignore the right fields', () => {
      expect(deployChangeMock).toHaveBeenCalledWith(
        change,
        client,
        getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Project.deployRequests,
        ['components', 'fieldConfigurationScheme'],
        undefined,
        undefined,
      )
    })

    it('should call the endpoint to get the projectId', () => {
      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/project/key',
        undefined,
      )
    })

    it('should call the endpoint to get the fieldConfigurationScheme', () => {
      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/fieldconfigurationscheme/project?projectId=3',
        undefined,
      )
    })

    it('should not call the endpoint to delete the fieldConfigurationScheme', () => {
      expect(connection.delete).not.toHaveBeenCalledWith(
        '/rest/api/3/fieldconfigurationscheme/4',
        undefined,
      )
    })

    it('should call the endpoint to get the components', () => {
      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/project/3',
        undefined,
      )
    })

    it('should call the endpoint to remove the components', () => {
      expect(connection.delete).toHaveBeenCalledWith(
        '/rest/api/3/component/1',
        undefined,
      )

      expect(connection.delete).toHaveBeenCalledWith(
        '/rest/api/3/component/2',
        undefined,
      )
    })
  })

  describe('onDeploy', () => {
    beforeEach(async () => {
      instance.value.id = 1
      await filter.onDeploy([toChange({ after: instance })])
    })

    it('should convert the id to string', async () => {
      expect(instance.value.id).toEqual('1')
    })
  })
})
