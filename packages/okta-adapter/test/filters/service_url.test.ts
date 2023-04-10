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

import { filterUtils } from '@salto-io/adapter-components'
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, getChangeData, toChange } from '@salto-io/adapter-api'
import { getFilterParams, mockClient } from '../utils'
import OktaClient, { getAdminUrl } from '../../src/client/client'
import serviceUrlFilter from '../../src/filters/service_url'
import { APPLICATION_TYPE_NAME, OKTA } from '../../src/constants'

describe('serviceUrlFilter', () => {
  let client: OktaClient
    type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy'>
    let filter: FilterType

    beforeEach(async () => {
      jest.clearAllMocks()
      const mockCli = mockClient()
      client = mockCli.client
      filter = serviceUrlFilter(getFilterParams({ client })) as typeof filter
    })

    describe('types using serviceUrl config', () => {
      const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
      const appInstance = new InstanceElement(
        'app1',
        appType,
        { id: 11, name: 'app1' },
      )

      describe('onFetch', () => {
        it('should add service url annotation for application if it is exist in the config', async () => {
          const elements = [appInstance].map(e => e.clone())
          await filter.onFetch(elements)
          const [instance] = elements
          expect(instance.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
            `${getAdminUrl(client.baseUrl)}/admin/app/${appInstance.value.name}/instance/${appInstance.value.id}/#tab-general`,
          )
        })
      })
      describe('onDeploy', () => {
        it('should add service url annotation for application if it is exist in the config', async () => {
          const changes = [appInstance].map(e => e.clone()).map(inst => toChange({ after: inst }))
          await filter.onDeploy(changes)
          const instance = getChangeData(changes[0])
          expect(instance.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
            `${getAdminUrl(client.baseUrl)}/admin/app/${appInstance.value.name}/instance/${appInstance.value.id}/#tab-general`,
          )
        })
      })
    })
})
