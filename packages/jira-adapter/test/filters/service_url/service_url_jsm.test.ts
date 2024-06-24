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
import { InstanceElement, CORE_ANNOTATIONS, toChange } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import JiraClient from '../../../src/client/client'
import { CUSTOMER_PERMISSIONS_TYPE, QUEUE_TYPE } from '../../../src/constants'
import filterCreator from '../../../src/filters/service_url/service_url_jsm'
import { getDefaultConfig } from '../../../src/config/config'

describe('service url filter', () => {
  let client: JiraClient
  let paginator: clientUtils.Paginator
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy'>
  let filter: FilterType
  const queueInstance = new InstanceElement('queue1', createEmptyType(QUEUE_TYPE), {
    id: 11,
    projectKey: 'PROJ1',
  })
  const customerPermission = new InstanceElement('customer_permission', createEmptyType(CUSTOMER_PERMISSIONS_TYPE), {
    id: 11,
    projectKey: 'PROJ1',
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    const mockCli = mockClient()
    client = mockCli.client
    paginator = mockCli.paginator
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = true
    config.fetch.enableJSMPremium = true
    filter = filterCreator(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter
  })

  describe('onFetch', () => {
    it('should add service url annotation if it is exist in the config', async () => {
      await filter.onFetch([queueInstance])
      expect(queueInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
        'https://ori-salto-test.atlassian.net/jira/servicedesk/projects/PROJ1/queues/custom/11',
      )
    })
    it('should not add service url annotation if it is not exist in the config', async () => {
      await filter.onFetch([customerPermission])
      expect(customerPermission.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
    })
  })
  describe('onDeploy', () => {
    it('should add service url annotation if it is exist in the config', async () => {
      const changes = [queueInstance].map(e => e.clone()).map(inst => toChange({ after: inst }))
      await filter.onDeploy(changes)
      expect(queueInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
        'https://ori-salto-test.atlassian.net/jira/servicedesk/projects/PROJ1/queues/custom/11',
      )
    })
  })
  it('should not add service url annotation if it is not exist in the config', async () => {
    const changes = [customerPermission].map(e => e.clone()).map(inst => toChange({ after: inst }))
    await filter.onDeploy(changes)
    expect(customerPermission.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
