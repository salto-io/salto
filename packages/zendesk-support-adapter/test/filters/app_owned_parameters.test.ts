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
import { ObjectType, ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { APP_OWNED_TYPE_NAME, ZENDESK_SUPPORT } from '../../src/constants'
import { paginate } from '../../src/client/pagination'
import filterCreator from '../../src/filters/app_owned_parameters'

describe('app_owned parameters filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const appOwnedType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, APP_OWNED_TYPE_NAME) })
  const appOwnedParameter = {
    id: 1901818,
    app_id: 772455,
    name: 'name',
    kind: 'text',
    required: true,
    position: 0,
    created_at: '2022-03-06T12:24:31Z',
    updated_at: '2022-03-06T12:24:31Z',
    secure: false,
  }
  const appOwnedOtherParameter = {
    id: 1901819,
    app_id: 772456,
    name: 'name2',
    kind: 'text2',
    required: true,
    position: 0,
    created_at: '2022-06-24T12:24:31Z',
    updated_at: '2022-06-24T12:24:31Z',
    secure: false,
  }
  const appOwnedInstance = new InstanceElement(
    'app_owned_test_name',
    appOwnedType,
    {
      owner_id: 12192413,
      name: 'xr_app',
      single_install: false,
      default_locale: 'en',
      author_name: 'John Doe',
      author_email: 'jdoe@example.com',
      short_description: 'short_description_test',
      long_description: 'long_description_test',
      raw_long_description: 'raw_long_description_test',
      installation_instructions: 'installation_instrunctions_test',
      raw_installation_instructions: 'Simply click install.',
      small_icon: 'https://example.com/icon.png',
      large_icon: 'https://example.com/large_icon.png',
      visibility: 'private',
      installable: true,
      framework_version: '2.0',
      featured: false,
      promoted: false,
      products: [
        'support',
      ],
      version: '1.0',
      marketing_only: false,
      deprecated: false,
      obsolete: false,
      paid: false,
      state: 'published',
      closed_preview: false,
      parameters: [appOwnedParameter, appOwnedOtherParameter],
    },
  )

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
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  describe('onFetch', () => {
    it('should add the correct type and instances and convert parameters field to map', async () => {
      const elements = [
        appOwnedType.clone(),
        appOwnedInstance.clone(),
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.app_owned',
          'zendesk_support.app_owned.instance.app_owned_test_name',
        ])
      const appOwnedInstanceElements = elements.filter(isInstanceElement)
      expect(appOwnedInstanceElements).toHaveLength(1)

      const appOwnedInstanceElement = appOwnedInstanceElements[0]
      expect(appOwnedInstanceElement).toBeDefined()

      const appOwnedInstanceElementParameters = appOwnedInstanceElement.value.parameters
      expect(appOwnedInstanceElementParameters).toBeDefined()
      expect(Object.keys(appOwnedInstanceElementParameters)).toHaveLength(2)
      expect(appOwnedInstanceElementParameters[appOwnedParameter.name]).toBeDefined()
      expect(appOwnedInstanceElementParameters[appOwnedOtherParameter.name]).toBeDefined()
    })
  })
})
