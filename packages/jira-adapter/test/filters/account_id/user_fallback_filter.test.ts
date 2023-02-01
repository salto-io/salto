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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { client as clientUtils, filterUtils, config as configUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import userFallbackFilter from '../../../src/filters/account_id/user_fallback_filter'
import { JIRA } from '../../../src/constants'

describe('user_fallback_filter', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let filter: filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let config: JiraConfig
  let instance: InstanceElement

  beforeEach(() => {
    const projectType = new ObjectType({
      elemID: new ElemID(JIRA, 'Project'),
    })

    instance = new InstanceElement(
      'instance',
      projectType,
      {
        leadAccountId: {
          id: 'notExist',
        },
      },
    )
  })

  describe('cloud', () => {
    beforeEach(() => {
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      const { client, paginator, connection, getUserMapFunc } = mockClient()
      mockConnection = connection
      filter = userFallbackFilter(getFilterParams({
        client,
        paginator,
        config,
        getUserMapFunc,
      })) as typeof filter

      mockConnection.get.mockImplementation(async url => {
        if (url === '/rest/api/3/myself') {
          return {
            status: 200,
            data: {
              accountId: '2',
              displayName: 'disp2',
              locale: 'en_US',
              emailAddress: 'email2',
            },
          }
        }

        return {
          status: 200,
          data: [
            {
              accountId: '1',
              displayName: 'disp1',
              locale: 'en_US',
              emailAddress: 'email1',
            },
            {
              accountId: '2',
              displayName: 'disp2',
              locale: 'en_US',
              emailAddress: 'email2',
            },
          ],
        }
      })
    })

    it('should replace the account id with the default id if it does not exist', async () => {
      config.deploy.defaultMissingUserFallback = 'email2'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('2')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })

    it('should not replace the account id with the default id if it exist', async () => {
      instance.value.leadAccountId.id = '1'
      config.deploy.defaultMissingUserFallback = 'email2'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('1')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('1')
    })

    it('should replace the account id with the current deployer if requested', async () => {
      config.deploy.defaultMissingUserFallback = configUtils.DEPLOYER_FALLBACK_VALUE
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('2')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })

    it('should not replace the account id with the default if the default not exist', async () => {
      config.deploy.defaultMissingUserFallback = 'email3'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })

    it('should not replace the account id when there is no default', async () => {
      config.deploy.defaultMissingUserFallback = undefined
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })
  })

  describe('datacenter', () => {
    beforeEach(() => {
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
      const { client, paginator, connection, getUserMapFunc } = mockClient(true)
      mockConnection = connection
      filter = userFallbackFilter(getFilterParams({
        client,
        paginator,
        config,
        getUserMapFunc,
      })) as typeof filter

      mockConnection.get.mockImplementation(async url => {
        if (url === '/rest/api/2/myself') {
          return {
            status: 200,
            data: {
              key: '2',
              name: 'name2',
              displayName: 'disp2',
              locale: 'en_US',
              emailAddress: 'email2',
            },
          }
        }

        return {
          status: 200,
          data: [
            {
              key: '1',
              name: 'name1',
              displayName: 'disp1',
              locale: 'en_US',
              emailAddress: 'email1',
            },
            {
              key: '2',
              name: 'name2',
              displayName: 'disp2',
              locale: 'en_US',
              emailAddress: 'email2',
            },
          ],
        }
      })
    })

    it('should replace the account id with the default id if it does not exist', async () => {
      config.deploy.defaultMissingUserFallback = 'name2'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('name2')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })

    it('should not replace the account id with the default id if it exist', async () => {
      instance.value.leadAccountId.id = 'name1'
      config.deploy.defaultMissingUserFallback = 'name2'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('name1')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('name1')
    })

    it('should replace the account id with the current deployer if requested', async () => {
      config.deploy.defaultMissingUserFallback = configUtils.DEPLOYER_FALLBACK_VALUE
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('name2')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    }, 1000000)

    it('should not replace the account id with the default if the default not exist', async () => {
      config.deploy.defaultMissingUserFallback = 'name3'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })
  })
})
