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
import { ElemID, InstanceElement, ObjectType, Element } from '@salto-io/adapter-api'
import _ from 'lodash'
import { buildElementsSourceFromElements, safeJsonStringify } from '@salto-io/adapter-utils'
import { filterUtils, client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { mockClient } from '../../utils'
import automationFetchFilter from '../../../src/filters/automation/automation_fetch'
import { DEFAULT_CONFIG, JiraConfig } from '../../../src/config'
import { JIRA, PROJECT_TYPE } from '../../../src/constants'
import JiraClient from '../../../src/client/client'
import { createAutomationTypes } from '../../../src/filters/automation/types'
import { CLOUD_RESOURCE_FIELD } from '../../../src/filters/automation/cloud_id'


describe('automationFetchFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let projectType: ObjectType
  let projectInstance: InstanceElement
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>


  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn

    config = _.cloneDeep(DEFAULT_CONFIG)
    filter = automationFetchFilter({
      client,
      paginator,
      config,
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as filterUtils.FilterWith<'onFetch'>

    projectType = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_TYPE),
    })

    projectInstance = new InstanceElement(
      'projectInstance',
      projectType,
      {
        name: 'projectName',
        id: '2',
      }
    )

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
  })

  describe('onFetch', () => {
    it('should fetch automations from the service', async () => {
      const elements = [projectInstance]
      await filter.onFetch(elements)


      const automationTypes = createAutomationTypes()
      expect(elements).toHaveLength(
        1 // original project
        + 1 // new automation
        + 1 // automation top level type
        + automationTypes.subTypes.length
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
        ],
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
          limit: 100,
        },
        undefined,
      )
    })

    it('should fetch automations if usePrivateApi is false', async () => {
      config.client.usePrivateAPI = false
      const elements = [projectInstance]
      await filter.onFetch(elements)


      expect(elements).toHaveLength(1)

      expect(connection.post).not.toHaveBeenCalled()
    })

    it('should use elemIdGetter', async () => {
      const { paginator } = mockClient()
      filter = automationFetchFilter({
        client,
        paginator,
        config,
        elementsSource: buildElementsSourceFromElements([]),
        getElemIdFunc: () => new ElemID(JIRA, 'someName'),
        fetchQuery: elementUtils.query.createMockQuery(),
      }) as filterUtils.FilterWith<'onFetch'>

      const elements = [projectInstance]
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
              unparsedData: {
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

      const elements = [projectInstance]
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

      const elements = [projectInstance]
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

      const elements = [projectInstance]
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

      const elements = [projectInstance]
      await expect(filter.onFetch(elements)).rejects.toThrow()
    })
  })
})
