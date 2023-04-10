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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, getChangeData, toChange } from '@salto-io/adapter-api'
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

    describe('cheking object types that use addUrlToInstance() and can be filtered using the config', () => {
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
            `${client.baseUrlWithAdmin}/admin/app/${appInstance.value.name}/instance/${appInstance.value.id}/#tab-general`,
          )
        })
      })
      describe('onDeploy', () => {
        it('should add service url annotation for application if it is exist in the config', async () => {
          const changes = [appInstance].map(e => e.clone()).map(inst => toChange({ after: inst }))
          await filter.onDeploy(changes)
          const instance = getChangeData(changes[0])
          expect(instance.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
            `${client.baseUrlWithAdmin}/admin/app/${appInstance.value.name}/instance/${appInstance.value.id}/#tab-general`,
          )
        })
      })
    })
    describe('cheking user schame object type', () => {
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
      const userSchemaInstaceWithoutParents = new InstanceElement(
        'schema',
        userSchemaType,
        { id: 12 },
        undefined,
        {},
      )
      describe('onFetch', () => {
        it('should add service url annotation for userSchema if it has userType as reference expression', async () => {
          const elements = [userSchemaInstace].map(e => e.clone())
          await filter.onFetch(elements)
          const [instance] = elements
          expect(instance.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
            `${client.baseUrlWithAdmin}/admin/universaldirectory#okta/${userTypeInstance.value.id}`,
          )
        })
        it('should not add service url annotation for userSchema if it has no parents annotation', async () => {
          const elements = [userSchemaInstaceWithoutParents.clone()]
          delete elements[0].annotations[CORE_ANNOTATIONS.PARENT]
          await filter.onFetch(elements)
          const [instance] = elements
          expect(instance.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
        })
      })
      describe('onDeploy', () => {
        it('should add service url annotation for userSchema if it has userType as reference expression', async () => {
          const changes = [userSchemaInstace].map(e => e.clone()).map(inst => toChange({ after: inst }))
          await filter.onDeploy(changes)
          const instance = getChangeData(changes[0])
          expect(instance.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
            `${client.baseUrlWithAdmin}/admin/universaldirectory#okta/${userTypeInstance.value.id}`,
          )
        })
      })
    })
})
