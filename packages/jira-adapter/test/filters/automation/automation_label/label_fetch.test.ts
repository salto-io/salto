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
import { ElemID, InstanceElement, ObjectType, Element } from '@salto-io/adapter-api'
import _ from 'lodash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { filterUtils, client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../../utils'
import automationLabelFetchFilter from '../../../../src/filters/automation/automation_label/label_fetch'
import { getDefaultConfig, JiraConfig } from '../../../../src/config/config'
import { JIRA } from '../../../../src/constants'
import JiraClient from '../../../../src/client/client'
import { createAutomationLabelType } from '../../../../src/filters/automation/automation_label/types'
import { CLOUD_RESOURCE_FIELD } from '../../../../src/filters/automation/cloud_id'


describe('automationLabelFetchFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let automationLabelType: ObjectType
  let automationLabelInstance: InstanceElement
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let fetchQuery: MockInterface<elementUtils.query.ElementQuery>

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    automationLabelType = createAutomationLabelType()
    automationLabelInstance = new InstanceElement(
      'labelName',
      automationLabelType,
      {
        id: 555,
        name: 'labelName',
        color: 'color',
      },
    )

    fetchQuery = elementUtils.query.createMockQuery()

    filter = automationLabelFetchFilter(getFilterParams({
      client,
      paginator,
      config,
      fetchQuery,
    })) as filterUtils.FilterWith<'onFetch'>

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
      throw new Error(`Unexpected url ${url}`)
    })
    connection.get.mockImplementation(async url => {
      if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule-labels') {
        return {
          status: 200,
          data: [{
            id: 555,
            name: 'labelName',
            color: 'color',
          }],
        }
      }
      throw new Error(`Unexpected url ${url}`)
    })
  })

  describe('onFetch', () => {
    it('should fetch automation labels from the service', async () => {
      const elements = [] as Element[]
      await filter.onFetch(elements)

      expect(elements).toHaveLength(2)

      const automationLabel = elements[0] as InstanceElement
      const labelType = elements[1]

      expect(automationLabel.elemID.getFullName()).toEqual('jira.AutomationLabel.instance.labelName')

      expect(automationLabel.value).toEqual(automationLabelInstance.value)

      expect(labelType).toEqual(automationLabelType)

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

      expect(connection.get).toHaveBeenCalledWith(
        '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule-labels',
        undefined
      )
    })

    it('should fetch automation labels in Jira DC', async () => {
      const { client: cli, connection: conn } = mockClient(true)
      client = cli
      connection = conn

      filter = automationLabelFetchFilter(getFilterParams({
        client,
      })) as filterUtils.FilterWith<'onFetch'>

      connection.get.mockImplementation(async url => {
        if (url === '/rest/cb-automation/latest/rule-label') {
          return {
            status: 200,
            data: [{
              id: 555,
              name: 'labelName',
              color: 'color',
            }],
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })
      const elements = [] as Element[]
      await filter.onFetch(elements)

      expect(elements).toHaveLength(2)

      const automationLabel = elements[0] as InstanceElement
      const labelType = elements[1]

      expect(automationLabel.elemID.getFullName()).toEqual('jira.AutomationLabel.instance.labelName')

      expect(automationLabel.value).toEqual(automationLabelInstance.value)

      expect(labelType).toEqual(automationLabelType)

      expect(connection.get).toHaveBeenCalledWith(
        '/rest/cb-automation/latest/rule-label',
        undefined,
      )
    })

    it('should not fetch automation labels if usePrivateApi is false', async () => {
      config.client.usePrivateAPI = false
      const elements = [] as Element[]
      await filter.onFetch(elements)

      expect(elements).toHaveLength(0)

      expect(connection.post).not.toHaveBeenCalled()
    })

    it('should not fetch automation labels if automation labels were excluded', async () => {
      fetchQuery.isTypeMatch.mockReturnValue(false)
      config.client.usePrivateAPI = false
      const elements = [] as Element[]
      await filter.onFetch(elements)

      expect(elements).toHaveLength(0)

      expect(connection.post).not.toHaveBeenCalled()
    })

    it('should use elemIdGetter', async () => {
      const { paginator } = mockClient()
      filter = automationLabelFetchFilter(getFilterParams({
        client,
        paginator,
        config,
        getElemIdFunc: () => new ElemID(JIRA, 'someName'),
      })) as filterUtils.FilterWith<'onFetch'>

      const elements = [] as Element[]
      await filter.onFetch(elements)

      const automation = elements[0]
      expect(automation.elemID.getFullName()).toEqual('jira.AutomationLabel.instance.someName')
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

        throw new Error(`Unexpected url ${url}`)
      })

      const elements = [] as Element[]
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

        throw new Error(`Unexpected url ${url}`)
      })

      const elements = [] as Element[]
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
        throw new Error(`Unexpected url ${url}`)
      })

      const elements = [] as Element[]
      await expect(filter.onFetch(elements)).rejects.toThrow()
    })

    it('should throw if automation label response is not valid', async () => {
      connection.get.mockImplementation(async url => {
        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule-labels') {
          return {
            status: 200,
            data: [{
              name: 'labelName',
              color: 'color',
            }],
          }
        }

        throw new Error(`Unexpected url ${url}`)
      })

      const elements = [] as Element[]
      await expect(filter.onFetch(elements)).rejects.toThrow()
    })
  })
})
