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
import { ElemID, InstanceElement, ObjectType, Element, BuiltinTypes, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { filterUtils, client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { HTTPError } from '@salto-io/adapter-components/src/client'
import { TransformationConfig } from '@salto-io/adapter-components/src/config_deprecated'
import { getFilterParams, mockClient } from '../../utils'
import automationFetchFilter from '../../../src/filters/automation/automation_fetch'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA, OBJECT_TYPE_TYPE, PROJECT_TYPE } from '../../../src/constants'
import JiraClient from '../../../src/client/client'
import { createAutomationTypes } from '../../../src/filters/automation/types'
import { CLOUD_RESOURCE_FIELD } from '../../../src/filters/automation/cloud_id'

jest.mock('../../../src/constants', () => ({
  ...jest.requireActual<{}>('../../../src/constants'),
  AUTOMATION_RETRY_PERIODS: [1, 2, 3, 4],
}))

describe('automationFetchFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let projectType: ObjectType
  let project2Instance: InstanceElement
  let project3Instance: InstanceElement
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let fetchQuery: MockInterface<elementUtils.query.ElementQuery>

  const automationResponse = {
    status: 200,
    data: {
      total: 1,
      values: [
        {
          id: '1',
          name: 'automationName',
          projects: [
            {
              projectId: '2',
            },
            {
              projectId: '3',
            },
          ],
          ruleScope: {
            resources: [
              'ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8:project/2',
              'ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8:project/3',
            ],
          },
          ruleHome: 'some value', // should always omit this field
        },
      ],
    },
  }

  const mockPostResponse = (url: string): Value => {
    if (url === '/rest/webResources/1.0/resources') {
      return {
        status: 200,
        data: {
          unparsedData: {
            [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
              tenantId: 'cloudId',
            }),
          },
        },
      }
    }

    if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules') {
      return automationResponse
    }

    throw new Error(`Unexpected url ${url}`)
  }

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    fetchQuery = elementUtils.query.createMockQuery()

    filter = automationFetchFilter(
      getFilterParams({
        client,
        paginator,
        config,
        fetchQuery,
      }),
    ) as filterUtils.FilterWith<'onFetch'>

    projectType = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_TYPE),
    })

    project2Instance = new InstanceElement('project2Instance', projectType, {
      name: 'projectName',
      id: '2',
    })

    project3Instance = new InstanceElement('project3Instance', projectType, {
      name: 'otherName',
      id: '3',
    })
    connection.post.mockClear()
    connection.post.mockImplementation(mockPostResponse)
  })

  describe('onFetch', () => {
    it('should fetch automations from the service', async () => {
      const elements = [project2Instance, project3Instance]
      await filter.onFetch(elements)

      const automationTypes = createAutomationTypes()
      expect(elements).toHaveLength(
        2 + // original projects
          1 + // new automation
          1 + // automation top level type
          automationTypes.subTypes.length,
      )

      const automation = elements[2]

      expect(automation.elemID.getFullName()).toEqual('jira.Automation.instance.automationName_otherName_projectName')

      expect(automation.value).toEqual({
        id: '1',
        name: 'automationName',
        projects: [
          {
            projectId: '2',
          },
          {
            projectId: '3',
          },
        ],
        ruleScope: {
          resources: [
            'ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8:project/2',
            'ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8:project/3',
          ],
        },
      })

      expect(connection.post).toHaveBeenCalledWith(
        '/rest/webResources/1.0/resources',
        {
          r: [],
          c: ['jira.webresources:jira-global'],
          xc: [],
          xr: [],
        },
        undefined,
      )

      expect(connection.post).toHaveBeenCalledWith(
        '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules',
        {
          offset: 0,
          limit: 1000,
        },
        undefined,
      )
    })

    it('should fetch automations from the service in jira dc', async () => {
      const { client: cli, connection: conn } = mockClient(true)
      client = cli
      connection = conn

      conn.get.mockImplementation(async url => {
        if (url === '/rest/cb-automation/latest/project/GLOBAL/rule') {
          return {
            status: 200,
            data: automationResponse.data.values,
          }
        }

        throw new Error(`Unexpected url ${url}`)
      })

      filter = automationFetchFilter(
        getFilterParams({
          client,
        }),
      ) as filterUtils.FilterWith<'onFetch'>

      const elements = [project2Instance]
      await filter.onFetch(elements)

      const automationTypes = createAutomationTypes()
      expect(elements).toHaveLength(
        1 + // original project
          1 + // new automation
          1 + // automation top level type
          automationTypes.subTypes.length,
      )

      const automation = elements[1]

      expect(automation.elemID.getFullName()).toEqual('jira.Automation.instance.automationName_projectName')

      expect(automation.value).toEqual({
        id: '1',
        name: 'automationName',
        projects: [
          {
            projectId: '2',
          },
          {
            projectId: '3',
          },
        ],
        ruleScope: {
          resources: [
            'ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8:project/2',
            'ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8:project/3',
          ],
        },
      })

      expect(connection.post).not.toHaveBeenCalled()
      expect(connection.get).toHaveBeenCalledWith('/rest/cb-automation/latest/project/GLOBAL/rule', undefined)
    })

    it('should not fetch automations if usePrivateApi is false', async () => {
      config.client.usePrivateAPI = false
      const elements = [project2Instance]
      await filter.onFetch(elements)

      expect(elements).toHaveLength(1)

      expect(connection.post).not.toHaveBeenCalled()
    })

    it('should not fetch automations if automations were excluded', async () => {
      fetchQuery.isTypeMatch.mockReturnValue(false)
      config.client.usePrivateAPI = false
      const elements = [project2Instance]
      await filter.onFetch(elements)

      expect(elements).toHaveLength(1)

      expect(connection.post).not.toHaveBeenCalled()
    })

    it('should use elemIdGetter', async () => {
      const { paginator } = mockClient()
      filter = automationFetchFilter(
        getFilterParams({
          client,
          paginator,
          config,
          getElemIdFunc: () => new ElemID(JIRA, 'someName'),
        }),
      ) as filterUtils.FilterWith<'onFetch'>

      const elements = [project2Instance]
      await filter.onFetch(elements)

      const automation = elements[1]
      expect(automation.elemID.getFullName()).toEqual('jira.Automation.instance.someName')
    })

    it('should not use project name if not found', async () => {
      const elements: Element[] = []
      await filter.onFetch(elements)

      const automation = elements[0]
      expect(automation.elemID.getFullName()).toEqual('jira.Automation.instance.automationName')
    })

    it('should throw if resources response is invalid', async () => {
      connection.post.mockImplementation(async url => {
        if (url === '/rest/webResources/1.0/resources') {
          return {
            status: 200,
            data: {
              unparsedData: {},
            },
          }
        }

        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules') {
          return {
            status: 200,
            data: {
              total: 1,
              values: [
                {
                  id: '1',
                  name: 'automationName',
                  projects: [
                    {
                      projectId: '2',
                    },
                  ],
                },
              ],
            },
          }
        }

        throw new Error(`Unexpected url ${url}`)
      })

      const elements = [project2Instance]
      await expect(filter.onFetch(elements)).rejects.toThrow()
    })

    it('should throw if cloud resource is not an object', async () => {
      connection.post.mockImplementation(async url => {
        if (url === '/rest/webResources/1.0/resources') {
          return {
            status: 200,
            data: {
              unparsedData: {
                [CLOUD_RESOURCE_FIELD]: '[]',
              },
            },
          }
        }

        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules') {
          return {
            status: 200,
            data: {
              total: 1,
              values: [
                {
                  id: '1',
                  name: 'automationName',
                  projects: [
                    {
                      projectId: '2',
                    },
                  ],
                },
              ],
            },
          }
        }

        throw new Error(`Unexpected url ${url}`)
      })

      const elements = [project2Instance]
      await expect(filter.onFetch(elements)).rejects.toThrow()
    })

    it('should throw if tenantId not in response', async () => {
      connection.post.mockImplementation(async url => {
        if (url === '/rest/webResources/1.0/resources') {
          return {
            status: 200,
            data: {
              unparsedData: {
                [CLOUD_RESOURCE_FIELD]: '{}',
              },
            },
          }
        }

        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules') {
          return {
            status: 200,
            data: {
              total: 1,
              values: [
                {
                  id: '1',
                  name: 'automationName',
                  projects: [
                    {
                      projectId: '2',
                    },
                  ],
                },
              ],
            },
          }
        }

        throw new Error(`Unexpected url ${url}`)
      })

      const elements = [project2Instance]
      await expect(filter.onFetch(elements)).rejects.toThrow()
    })

    it('should throw if automation response is not valid', async () => {
      connection.post.mockImplementation(async url => {
        if (url === '/rest/webResources/1.0/resources') {
          return {
            status: 200,
            data: {
              unparsedData: {
                [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
                  tenantId: 'cloudId',
                }),
              },
            },
          }
        }

        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules') {
          return {
            status: 200,
            data: {
              values: [
                {
                  id: '1',
                  name: 'automationName',
                },
              ],
            },
          }
        }

        throw new Error(`Unexpected url ${url}`)
      })

      const elements = [project2Instance]
      await expect(filter.onFetch(elements)).rejects.toThrow()
    })
  })
  it('should warn if response is 403', async () => {
    const { client: cli, connection: conn } = mockClient(true)
    client = cli
    connection = conn

    conn.get.mockImplementation(async url => {
      if (url === '/rest/cb-automation/latest/project/GLOBAL/rule') {
        throw new HTTPError('failed', { data: {}, status: 403 })
      }

      throw new Error(`Unexpected url ${url}`)
    })

    filter = automationFetchFilter(
      getFilterParams({
        client,
      }),
    ) as filterUtils.FilterWith<'onFetch'>
    const elements = [project2Instance]
    expect(await filter.onFetch(elements)).toEqual({
      errors: [
        {
          message:
            "Salto could not access the Automation resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource",
          severity: 'Warning',
        },
      ],
    })
  })
  it('should warn if response is 405', async () => {
    const { client: cli, connection: conn } = mockClient(true)
    client = cli
    connection = conn

    conn.get.mockImplementation(async url => {
      if (url === '/rest/cb-automation/latest/project/GLOBAL/rule') {
        throw new HTTPError('failed', { data: {}, status: 405 })
      }

      throw new Error(`Unexpected url ${url}`)
    })

    filter = automationFetchFilter(
      getFilterParams({
        client,
      }),
    ) as filterUtils.FilterWith<'onFetch'>
    const elements = [project2Instance]
    expect(await filter.onFetch(elements)).toEqual({
      errors: [
        {
          message:
            "Salto could not access the Automation resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource",
          severity: 'Warning',
        },
      ],
    })
  })
  it('should adjust elemID correctly when projects is part of idFields', async () => {
    const { client: cli, connection: conn } = mockClient(true)
    client = cli
    connection = conn
    conn.get.mockImplementation(async url => {
      if (url === '/rest/cb-automation/latest/project/GLOBAL/rule') {
        return {
          status: 200,
          data: automationResponse.data.values,
        }
      }

      throw new Error(`Unexpected url ${url}`)
    })

    filter = automationFetchFilter(
      getFilterParams({
        client,
      }),
    ) as filterUtils.FilterWith<'onFetch'>

    const elements = [project2Instance]
    await filter.onFetch(elements)

    const automation = elements[1]
    expect(automation.elemID.getFullName()).toEqual('jira.Automation.instance.automationName_projectName')
  })
  it('should not include project name in elemID if not part of idFields', async () => {
    const { client: cli, connection: conn } = mockClient(true)
    client = cli
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    const apiDefinitions = config.apiDefinitions.types.Automation.transformation as TransformationConfig
    apiDefinitions.idFields = ['name']
    connection = conn
    conn.get.mockImplementation(async url => {
      if (url === '/rest/cb-automation/latest/project/GLOBAL/rule') {
        return {
          status: 200,
          data: automationResponse.data.values,
        }
      }

      throw new Error(`Unexpected url ${url}`)
    })

    filter = automationFetchFilter(
      getFilterParams({
        client,
        config,
      }),
    ) as filterUtils.FilterWith<'onFetch'>

    const elements = [project3Instance]
    await filter.onFetch(elements)

    const automation = elements[1]
    expect(automation.elemID.getFullName()).toEqual('jira.Automation.instance.automationName')
  })
  it('should retry if response is 504', async () => {
    const { client: cli, connection: conn } = mockClient(false)
    client = cli
    connection = conn

    conn.post.mockImplementationOnce(mockPostResponse) // for cloud id
    conn.post.mockImplementationOnce(async () => {
      throw new HTTPError('failed', { data: {}, status: 504 })
    })
    conn.post.mockImplementationOnce(mockPostResponse)
    const elements = [project2Instance]
    await (
      automationFetchFilter(
        getFilterParams({
          client,
        }),
      ) as filterUtils.FilterWith<'onFetch'>
    ).onFetch(elements)

    expect(elements[1].elemID.getFullName()).toEqual('jira.Automation.instance.automationName_projectName')
  })
  it('should retry if response is 502', async () => {
    const { client: cli, connection: conn } = mockClient(false)
    client = cli
    connection = conn

    conn.post.mockImplementationOnce(mockPostResponse) // for cloud id
    conn.post.mockImplementationOnce(async () => {
      throw new HTTPError('failed', { data: {}, status: 502 })
    })
    conn.post.mockImplementationOnce(mockPostResponse)
    const elements = [project2Instance]
    await (
      automationFetchFilter(
        getFilterParams({
          client,
        }),
      ) as filterUtils.FilterWith<'onFetch'>
    ).onFetch(elements)

    expect(elements[1].elemID.getFullName()).toEqual('jira.Automation.instance.automationName_projectName')
  })
  it('should fail if retry response is 504 and passed retries count', async () => {
    const { client: cli, connection: conn } = mockClient(false)
    client = cli
    connection = conn
    conn.post.mockClear()
    conn.post.mockImplementationOnce(mockPostResponse) // for cloud id
    conn.post.mockImplementation(async () => {
      throw new HTTPError('failed', { data: {}, status: 504 })
    })

    const elements = [project2Instance]
    await expect(
      (
        automationFetchFilter(
          getFilterParams({
            client,
          }),
        ) as filterUtils.FilterWith<'onFetch'>
      ).onFetch(elements),
    ).rejects.toThrow()
    expect(conn.post.mock.calls.length).toEqual(6) // (1 for cloud id, 5 times for automation as we have 4 retries)
  })
  it('should fail without retries if error is not http', async () => {
    const { client: cli, connection: conn } = mockClient(false)
    client = cli
    connection = conn
    conn.post.mockClear()
    conn.post.mockImplementationOnce(mockPostResponse) // for cloud id
    conn.post.mockImplementation(async () => {
      throw new Error('failed')
    })
    const elements = [project2Instance]
    await expect(
      (
        automationFetchFilter(
          getFilterParams({
            client,
          }),
        ) as filterUtils.FilterWith<'onFetch'>
      ).onFetch(elements),
    ).rejects.toThrow()
    expect(conn.post.mock.calls.length).toEqual(2) // (1 for cloud id, 5 times for automation as we have 4 retries)
  })
  describe('component with assets in automation', () => {
    const automationResponseWithAssets = {
      status: 200,
      data: {
        total: 1,
        values: [
          {
            id: '1',
            name: 'automationName',
            projects: [],
            ruleScope: {
              resources: ['ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8'],
            },
            trigger: {
              component: 'ACTION',
              schemaVersion: 1,
              type: 'cmdb.object.create',
              value: {
                objectTypeId: '35',
                workspaceId: '68d020c3-b88e-47dc-9231-452f7dc63521',
                schemaLabel: 'idoA Schema',
                schemaId: '5',
                objectTypeLabel: 'R&D',
                attributes: [
                  {
                    name: 'Name',
                    value: 'idoA automation',
                    isLabel: true,
                  },
                ],
              },
              children: [],
              conditions: [],
            },
            components: [
              {
                component: 'ACTION',
                schemaVersion: 1,
                type: 'cmdb.object.create',
                value: {
                  objectTypeId: '35',
                  workspaceId: '68d020c3-b88e-47dc-9231-452f7dc63521',
                  schemaLabel: 'idoA Schema',
                  schemaId: '5',
                  objectTypeLabel: 'R&D',
                  attributes: [
                    {
                      name: 'Name',
                      value: 'idoA automation',
                      isLabel: true,
                    },
                  ],
                },
                children: [
                  {
                    component: 'ACTION',
                    schemaVersion: 1,
                    type: 'cmdb.object.create',
                    value: {
                      objectTypeId: '35',
                      workspaceId: '68d020c3-b88e-47dc-9231-452f7dc63521',
                      schemaLabel: 'idoA Schema',
                      schemaId: '5',
                      objectTypeLabel: 'R&D',
                      attributes: [
                        {
                          name: 'Name',
                          value: 'idoA automation',
                          isLabel: true,
                        },
                      ],
                    },
                    children: [],
                    conditions: [],
                  },
                ],
                conditions: [],
              },
            ],
          },
        ],
      },
    }
    const objectTypeType = new ObjectType({
      elemID: new ElemID(JIRA, OBJECT_TYPE_TYPE),
      fields: {
        id: {
          refType: BuiltinTypes.STRING,
        },
        name: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    const objectTypeInstnce = new InstanceElement('objectTypeInstance', objectTypeType, {
      id: '35',
      name: 'objectTypeName',
    })
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient()
      client = cli
      connection = conn
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      connection.post.mockImplementation(async url => {
        if (url === '/rest/webResources/1.0/resources') {
          return {
            status: 200,
            data: {
              unparsedData: {
                [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
                  tenantId: 'cloudId',
                }),
              },
            },
          }
        }

        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules') {
          return automationResponseWithAssets
        }

        throw new Error(`Unexpected url ${url}`)
      })
    })
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('should fetch automations without assets support from the service when enableJsm is false', async () => {
      const { paginator } = mockClient()
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      config.fetch.enableJSMPremium = false
      filter = automationFetchFilter(
        getFilterParams({
          client,
          paginator,
          config,
          fetchQuery,
        }),
      ) as filterUtils.FilterWith<'onFetch'>
      const elements = [objectTypeInstnce]
      await filter.onFetch(elements)

      const automationTypes = createAutomationTypes()
      expect(elements).toHaveLength(
        1 + // original objectTypeInstnce
          1 + // new automation
          1 + // automation top level type
          automationTypes.subTypes.length,
      )

      const automation = elements[1]

      expect(automation.elemID.getFullName()).toEqual('jira.Automation.instance.automationName')

      expect(automation.value).toEqual({
        id: '1',
        name: 'automationName',
        projects: [],
        ruleScope: {
          resources: ['ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8'],
        },
        trigger: {
          component: 'ACTION',
          type: 'cmdb.object.create',
          value: {
            objectTypeId: '35',
            workspaceId: '68d020c3-b88e-47dc-9231-452f7dc63521',
            schemaLabel: 'idoA Schema',
            schemaId: '5',
            objectTypeLabel: 'R&D',
            attributes: [
              {
                name: 'Name',
                value: 'idoA automation',
                isLabel: true,
              },
            ],
          },
          children: [],
          conditions: [],
        },
        components: [
          {
            component: 'ACTION',
            type: 'cmdb.object.create',
            value: {
              objectTypeId: '35',
              workspaceId: '68d020c3-b88e-47dc-9231-452f7dc63521',
              schemaLabel: 'idoA Schema',
              schemaId: '5',
              objectTypeLabel: 'R&D',
              attributes: [
                {
                  name: 'Name',
                  value: 'idoA automation',
                  isLabel: true,
                },
              ],
            },
            children: [
              {
                component: 'ACTION',
                type: 'cmdb.object.create',
                value: {
                  objectTypeId: '35',
                  workspaceId: '68d020c3-b88e-47dc-9231-452f7dc63521',
                  schemaLabel: 'idoA Schema',
                  schemaId: '5',
                  objectTypeLabel: 'R&D',
                  attributes: [
                    {
                      name: 'Name',
                      value: 'idoA automation',
                      isLabel: true,
                    },
                  ],
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
    it('should fetch automations with assets support from the service when enableJsm is true', async () => {
      const { paginator } = mockClient()
      config.fetch.enableJSM = true
      config.fetch.enableJSMPremium = true
      filter = automationFetchFilter(
        getFilterParams({
          client,
          paginator,
          config,
          fetchQuery,
        }),
      ) as filterUtils.FilterWith<'onFetch'>
      const elements = [objectTypeInstnce]
      await filter.onFetch(elements)

      const automationTypes = createAutomationTypes()
      expect(elements).toHaveLength(
        1 + // original objectTypeInstnce
          1 + // new automation
          1 + // automation top level type
          automationTypes.subTypes.length,
      )

      const automation = elements[1]

      expect(automation.elemID.getFullName()).toEqual('jira.Automation.instance.automationName')

      expect(automation.value).toEqual({
        id: '1',
        name: 'automationName',
        projects: [],
        ruleScope: {
          resources: ['ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8'],
        },
        trigger: {
          component: 'ACTION',
          type: 'cmdb.object.create',
          value: {
            objectTypeId: '35',
            schemaId: '5',
            attributes: [
              {
                name: 'Name',
                value: 'idoA automation',
                isLabel: true,
              },
            ],
          },
          children: [],
          conditions: [],
        },
        components: [
          {
            component: 'ACTION',
            type: 'cmdb.object.create',
            value: {
              objectTypeId: '35',
              schemaId: '5',
              attributes: [
                {
                  name: 'Name',
                  value: 'idoA automation',
                  isLabel: true,
                },
              ],
            },
            children: [
              {
                component: 'ACTION',
                type: 'cmdb.object.create',
                value: {
                  objectTypeId: '35',
                  schemaId: '5',
                  attributes: [
                    {
                      name: 'Name',
                      value: 'idoA automation',
                      isLabel: true,
                    },
                  ],
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
    it('should fetch automations with assets support from the service when enableJsm is true and only schemaId', async () => {
      connection.post.mockImplementation(async url => {
        if (url === '/rest/webResources/1.0/resources') {
          return {
            status: 200,
            data: {
              unparsedData: {
                [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
                  tenantId: 'cloudId',
                }),
              },
            },
          }
        }

        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules') {
          return {
            status: 200,
            data: {
              total: 1,
              values: [
                {
                  id: '1',
                  name: 'automationName',
                  projects: [],
                  ruleScope: {
                    resources: ['ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8'],
                  },
                  trigger: {
                    component: 'ACTION',
                    type: 'cmdb.object.create',
                    value: {
                      workspaceId: '68d020c3-b88e-47dc-9231-452f7dc63521',
                      schemaLabel: 'idoA Schema',
                      schemaId: '5',
                      objectTypeLabel: 'R&D',
                      attributes: [
                        {
                          name: 'Name',
                          value: 'idoA automation',
                          isLabel: true,
                        },
                      ],
                    },
                    children: [],
                    conditions: [],
                  },
                  components: [
                    {
                      component: 'ACTION',
                      type: 'cmdb.object.create',
                      value: {
                        workspaceId: '68d020c3-b88e-47dc-9231-452f7dc63521',
                        schemaLabel: 'idoA Schema',
                        schemaId: '5',
                        attributes: [
                          {
                            name: 'Name',
                            value: 'idoA automation',
                            isLabel: true,
                          },
                        ],
                      },
                      children: [],
                      conditions: [],
                    },
                  ],
                },
              ],
            },
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })
      const { paginator } = mockClient()
      config.fetch.enableJSM = true
      config.fetch.enableJSMPremium = true
      filter = automationFetchFilter(
        getFilterParams({
          client,
          paginator,
          config,
          fetchQuery,
        }),
      ) as filterUtils.FilterWith<'onFetch'>
      const elements = [objectTypeInstnce]
      await filter.onFetch(elements)
      const automationTypes = createAutomationTypes()
      expect(elements).toHaveLength(
        1 + // original objectTypeInstnce
          1 + // new automation
          1 + // automation top level type
          automationTypes.subTypes.length,
      )

      const automation = elements[1]

      expect(automation.elemID.getFullName()).toEqual('jira.Automation.instance.automationName')

      expect(automation.value).toEqual({
        id: '1',
        name: 'automationName',
        projects: [],
        ruleScope: {
          resources: ['ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8'],
        },
        trigger: {
          component: 'ACTION',
          type: 'cmdb.object.create',
          value: {
            schemaId: '5',
            attributes: [
              {
                name: 'Name',
                value: 'idoA automation',
                isLabel: true,
              },
            ],
          },
          children: [],
          conditions: [],
        },
        components: [
          {
            component: 'ACTION',
            type: 'cmdb.object.create',
            value: {
              schemaId: '5',
              attributes: [
                {
                  name: 'Name',
                  value: 'idoA automation',
                  isLabel: true,
                },
              ],
            },
            children: [],
            conditions: [],
          },
        ],
      })
    })
    it('should not modify components if not expected asset component', async () => {
      connection.post.mockImplementation(async url => {
        if (url === '/rest/webResources/1.0/resources') {
          return {
            status: 200,
            data: {
              unparsedData: {
                [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
                  tenantId: 'cloudId',
                }),
              },
            },
          }
        }

        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules') {
          return {
            status: 200,
            data: {
              total: 1,
              values: [
                {
                  id: '1',
                  name: 'automationName',
                  projects: [],
                  ruleScope: {
                    resources: ['ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8'],
                  },
                  trigger: {},
                  components: [
                    {
                      component: 'ACTION',
                      type: 'cmdb.object.create',
                      value: {
                        objectTypeId: '35',
                        schemaLabel: 'idoA Schema',
                        objectTypeLabel: 'R&D',
                        attributes: [
                          {
                            name: 'Name',
                            value: 'idoA automation',
                            isLabel: true,
                          },
                        ],
                      },
                      children: [],
                      conditions: [],
                    },
                  ],
                },
              ],
            },
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })
      const { paginator } = mockClient()
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      filter = automationFetchFilter(
        getFilterParams({
          client,
          paginator,
          config,
          fetchQuery,
        }),
      ) as filterUtils.FilterWith<'onFetch'>
      const elements = [objectTypeInstnce]
      await filter.onFetch(elements)
      const automationTypes = createAutomationTypes()
      expect(elements).toHaveLength(
        1 + // original objectTypeInstnce
          1 + // new automation
          1 + // automation top level type
          automationTypes.subTypes.length,
      )

      const automation = elements[1]

      expect(automation.elemID.getFullName()).toEqual('jira.Automation.instance.automationName')

      expect(automation.value).toEqual({
        id: '1',
        name: 'automationName',
        projects: [],
        ruleScope: {
          resources: ['ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8'],
        },
        trigger: {},
        components: [
          {
            component: 'ACTION',
            type: 'cmdb.object.create',
            value: {
              objectTypeId: '35',
              schemaLabel: 'idoA Schema',
              objectTypeLabel: 'R&D',
              attributes: [
                {
                  name: 'Name',
                  value: 'idoA automation',
                  isLabel: true,
                },
              ],
            },
            children: [],
            conditions: [],
          },
        ],
      })
    })
    it('should do nothing if no components', async () => {
      connection.post.mockImplementation(async url => {
        if (url === '/rest/webResources/1.0/resources') {
          return {
            status: 200,
            data: {
              unparsedData: {
                [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
                  tenantId: 'cloudId',
                }),
              },
            },
          }
        }

        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rules') {
          return {
            status: 200,
            data: {
              total: 1,
              values: [
                {
                  id: '1',
                  name: 'automationName',
                  projects: [],
                  ruleScope: {
                    resources: ['ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8'],
                  },
                },
              ],
            },
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })
      const { paginator } = mockClient()
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      filter = automationFetchFilter(
        getFilterParams({
          client,
          paginator,
          config,
          fetchQuery,
        }),
      ) as filterUtils.FilterWith<'onFetch'>
      const elements = [objectTypeInstnce]
      await filter.onFetch(elements)
      const automationTypes = createAutomationTypes()
      expect(elements).toHaveLength(
        1 + // original objectTypeInstnce
          1 + // new automation
          1 + // automation top level type
          automationTypes.subTypes.length,
      )

      const automation = elements[1]

      expect(automation.elemID.getFullName()).toEqual('jira.Automation.instance.automationName')

      expect(automation.value).toEqual({
        id: '1',
        name: 'automationName',
        projects: [],
        ruleScope: {
          resources: ['ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8'],
        },
      })
    })
  })
})
