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
import { ObjectType, ElemID, InstanceElement, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { ZENDESK_SUPPORT } from '../../src/constants'
import { paginate } from '../../src/client/pagination'
import filterCreator from '../../src/filters/service_url'

describe('restriction filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const roleObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'custom_role') })
  const roleInst = new InstanceElement('role', roleObjType, { id: 11, name: 'role' })
  const testObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'test') })
  const testInst = new InstanceElement('test', testObjType, { id: 11, name: 'test' })

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: DEFAULT_CONFIG,
    }) as FilterType
  })

  describe('onFetch', () => {
    it('should add service url annotation if it is exist in the config', async () => {
      const elements = [roleInst].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual(['zendesk_support.custom_role.instance.role'])
      const [instance] = elements
      expect(instance.annotations).toEqual({
        [CORE_ANNOTATIONS.SERVICE_URL]: 'https://ignore.zendesk.com/admin/people/team/roles/11',
      })
    })
    it('should not add service url annotation if it is not exist in the config', async () => {
      const elements = [testInst].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual(['zendesk_support.test.instance.test'])
      const [instance] = elements
      expect(instance.annotations).toEqual({})
    })
  })
})
