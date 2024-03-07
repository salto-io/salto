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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/guide_category'

import { ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import ZendeskClient from '../../src/client/client'
import { FilterResult } from '../../src/filter'

describe('guide category filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy', FilterResult>
  let filter: FilterType
  let client: ZendeskClient
  let mockPut: jest.SpyInstance

  const categoryInstance = new InstanceElement(
    'instance',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'category') }),
    {
      locale: 'he',
      source_locale: 'he',
      id: 1111,
      outdated: false,
    },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator(
      createFilterCreatorParams({
        client,
      }),
    ) as FilterType
  })

  describe('deploy', () => {
    beforeEach(() => {
      mockPut = jest.spyOn(client, 'put')
      mockPut.mockImplementation(params => {
        if (['/api/v2/help_center/category/1111/source_locale'].includes(params.url)) {
          return {
            status: 200,
          }
        }
        throw new Error('Err')
      })
    })
    it('should send a separate request when updating default_locale', async () => {
      const categoryInstanceCopy = categoryInstance.clone()
      categoryInstanceCopy.value.source_locale = 'ar'
      await filter.deploy([{ action: 'modify', data: { before: categoryInstance, after: categoryInstanceCopy } }])
      expect(mockPut).toHaveBeenCalledTimes(2)
    })
  })
})
