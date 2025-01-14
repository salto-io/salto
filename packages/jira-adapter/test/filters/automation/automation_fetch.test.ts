/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, Element, BuiltinTypes, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import {
  filterUtils,
  client as clientUtils,
  elements as elementUtils,
  config as configDeprecated,
} from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { FAULTY_CLOUD_ID_RESPONSE, DEFAULT_CLOUD_ID, getFilterParams, mockClient } from '../../utils'
import automationFetchFilter from '../../../src/filters/automation/automation_fetch'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA, OBJECT_TYPE_TYPE, PROJECT_TYPE } from '../../../src/constants'
import JiraClient from '../../../src/client/client'
import { createAutomationTypes } from '../../../src/filters/automation/types'

jest.mock('../../../src/constants', () => ({
  ...jest.requireActual<{}>('../../../src/constants'),
  AUTOMATION_RETRY_PERIODS: [1, 2, 3, 4],
}))

const DEFAULT_URL = `/gateway/api/automation/internal-api/jira/${DEFAULT_CLOUD_ID}/pro/rest/GLOBAL/rules`
describe('automationFetchFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let projectType: ObjectType
  let project2Instance: InstanceElement
  let project3Instance: InstanceElement
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let fetchQuery: MockInterface<elementUtils.query.ElementQuery>

  const automationResponseCloud = {
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
          tags: [
            // should always omit this field
            {
              ruleIdUuid: '018ea865-3a9c-7c73-95fc-0ecb6aa14456',
              tagType: 'CREATION_TYPE',
              tagValue: 'USER',
            },
          ],
        },
      ],
    },
  }

  const automationResponseDC = {
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
        },
      ],
    },
  }
  const mockPostResponse = (url: string): Value => {
    if (url === DEFAULT_URL) {
      return automationResponseCloud
    }

    throw new Error(`Unexpected url ${url}`)
  }

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient(false)
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
        DEFAULT_URL,
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
            data: automationResponseDC.data.values,
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
      const { client: cli, paginator, connection: conn } = mockClient(false, null)
      client = cli
      connection = conn
      connection.get.mockImplementation(FAULTY_CLOUD_ID_RESPONSE)
      connection.post.mockImplementation(async url => {
        if (url === DEFAULT_URL) {
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
      await expect(
        (
          automationFetchFilter(
            getFilterParams({
              client,
              paginator,
              config,
              fetchQuery,
            }),
          ) as filterUtils.FilterWith<'onFetch'>
        ).onFetch(elements),
      ).rejects.toThrow()
    })

    it('should throw if cloud resource is not an object', async () => {
      const { client: cli, paginator, connection: conn } = mockClient(false, null)
      client = cli
      connection = conn
      connection.get.mockImplementation(FAULTY_CLOUD_ID_RESPONSE)
      connection.post.mockImplementation(async url => {
        if (url === DEFAULT_URL) {
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
      await expect(
        (
          automationFetchFilter(
            getFilterParams({
              client,
              paginator,
              config,
              fetchQuery,
            }),
          ) as filterUtils.FilterWith<'onFetch'>
        ).onFetch(elements),
      ).rejects.toThrow()
    })

    it('should throw if tenantId not in response', async () => {
      const { client: cli, paginator, connection: conn } = mockClient(false, null)
      client = cli
      connection = conn
      connection.get.mockImplementation(FAULTY_CLOUD_ID_RESPONSE)
      connection.post.mockImplementation(async url => {
        if (url === DEFAULT_URL) {
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
      await expect(
        (
          automationFetchFilter(
            getFilterParams({
              client,
              paginator,
              config,
              fetchQuery,
            }),
          ) as filterUtils.FilterWith<'onFetch'>
        ).onFetch(elements),
      ).rejects.toThrow()
    })

    it('should throw if automation response is not valid', async () => {
      connection.post.mockImplementation(async url => {
        if (url === DEFAULT_URL) {
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
        throw new clientUtils.HTTPError('failed', { data: {}, status: 403 })
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
          detailedMessage:
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
        throw new clientUtils.HTTPError('failed', { data: {}, status: 405 })
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
          detailedMessage:
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
          data: automationResponseCloud.data.values,
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
    const apiDefinitions = config.apiDefinitions.types.Automation
      .transformation as configDeprecated.TransformationConfig
    apiDefinitions.idFields = ['name']
    connection = conn
    conn.get.mockImplementation(async url => {
      if (url === '/rest/cb-automation/latest/project/GLOBAL/rule') {
        return {
          status: 200,
          data: automationResponseCloud.data.values,
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
      throw new clientUtils.HTTPError('failed', { data: {}, status: 504 })
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
      throw new clientUtils.HTTPError('failed', { data: {}, status: 502 })
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
    conn.post.mockImplementation(async () => {
      throw new clientUtils.HTTPError('failed', { data: {}, status: 504 })
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
    expect(conn.post.mock.calls.length).toEqual(5) // 5 times for automation as we have 4 retries
  })
  it('should fail without retries if error is not http', async () => {
    const { client: cli, connection: conn } = mockClient(false)
    client = cli
    connection = conn
    conn.post.mockClear()
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
    expect(conn.post.mock.calls.length).toEqual(1)
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
      const { client: cli, connection: conn } = mockClient(false)
      client = cli
      connection = conn
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      connection.post.mockImplementation(async url => {
        if (url === DEFAULT_URL) {
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
        if (url === DEFAULT_URL) {
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
        if (url === DEFAULT_URL) {
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
        if (url === DEFAULT_URL) {
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
