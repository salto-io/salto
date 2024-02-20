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
import { filterUtils } from '@salto-io/adapter-components'
import { CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/add_important_values'
import { APP_INSTALLATION_TYPE_NAME, DYNAMIC_CONTENT_ITEM_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import ZendeskClient from '../../src/client/client'

describe('add important values filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let client: ZendeskClient

  const appInstallationType = new ObjectType({ elemID: new ElemID(ZENDESK, APP_INSTALLATION_TYPE_NAME) })
  const dynamicContentItemType = new ObjectType({ elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME) })

  beforeEach(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'brandWithHC' },
    })
    filter = filterCreator(createFilterCreatorParams({ client })) as FilterType
  })

  describe('onFetch', () => {
    it('should add important values annotation correctly', async () => {
      const clonedAppInstallationType = appInstallationType.clone()
      const clonedDynamicContentItemType = dynamicContentItemType.clone()
      const dummyType = new ObjectType({ elemID: new ElemID(ZENDESK, 'dummy') })
      await filter.onFetch([clonedAppInstallationType, clonedDynamicContentItemType, dummyType])
      expect(clonedAppInstallationType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        {
          value: 'enabled',
          highlighted: false,
          indexed: true,
        },
        {
          value: 'paid',
          highlighted: false,
          indexed: true,
        },
        {
          value: 'product',
          highlighted: false,
          indexed: true,
        },
      ])
      expect(clonedDynamicContentItemType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        {
          value: 'placeholder',
          highlighted: true,
          indexed: false,
        },
      ])
      expect(dummyType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).not.toBeDefined()
    })
  })
})
