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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import serviceUrlFilterCreator from '../../src/filters/service_url'
import { APPLICATION_TYPE_NAME, OKTA, USERTYPE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../../src/constants'

describe('serviceUrlFilterCreator', () => {
  let client: OktaClient
    type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy'>
    let filter: FilterType
    beforeEach(async () => {
      jest.clearAllMocks()
      const mockCli = mockClient()
      client = mockCli.client
      filter = serviceUrlFilterCreator(getFilterParams({ client })) as typeof filter
    })
    describe('onFetch', () => {
      it('should add service url annotation for application if it is exist in the config', async () => {
        const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
        const appInstance = new InstanceElement(
          'app1',
          appType,
          { id: 11, name: 'app1' },
        )

        const elements = [appInstance].map(e => e.clone())
        await filter.onFetch(elements)
        const [instance] = elements
        expect(instance.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
          `${client.baseUrlWithAdmin}/admin/app/${appInstance.value.name}/instance/${appInstance.value.id}/#tab-assignments`,
        )
      })
      it('should add service url annotation for userSchema if it has userType as reference expression', async () => {
        const userSchemaType = new ObjectType({ elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME) })
        const userTypeType = new ObjectType({ elemID: new ElemID(OKTA, USERTYPE_TYPE_NAME) })
        const userTypeInstance = new InstanceElement(
          'user1',
          userTypeType,
          { id: 11, name: 'user1' }
        )
        const userSchemaInstace = new InstanceElement(
          'schema',
          userSchemaType,
          { id: 12 },
          undefined,
          { [CORE_ANNOTATIONS.PARENT]: [
            new ReferenceExpression(userTypeInstance.elemID, userTypeInstance)] },
        )
        const elements = [userSchemaInstace].map(e => e.clone())
        await filter.onFetch(elements)
        const [instance] = elements
        expect(instance.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
          `${client.baseUrlWithAdmin}/admin/universaldirectory#okta/${userTypeInstance.value.id}`,
        )
      })
    })
})
