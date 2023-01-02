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
import {
  ObjectType, ElemID, InstanceElement, isInstanceElement,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { createFilterCreatorParams } from '../utils'
import ZendeskClient from '../../src/client/client'
import { EVERYONE_USER_TYPE, USER_SEGMENT_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator, { createEveryoneUserSegmentInstance } from '../../src/filters/everyone_user_segment'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'

describe('everyoneUserSegment filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const userSegmentType = new ObjectType({ elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME) })
  const everyoneUserSegmentInstance = createEveryoneUserSegmentInstance(userSegmentType)

  const generateElements = (): (InstanceElement | ObjectType)[] => ([userSegmentType])
    .map(element => element.clone())

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'brandWithHC' },
    })
    filter = filterCreator(createFilterCreatorParams({
      client,
      config: {
        ...DEFAULT_CONFIG,
        [FETCH_CONFIG]: {
          include: [{
            type: '.*',
          }],
          exclude: [],
          guide: {
            brands: ['.*'],
          },
        },
      },
    })) as FilterType
  })


  describe('onFetch', () => {
    let elements: (InstanceElement | ObjectType)[]

    beforeAll(() => {
      elements = generateElements()
    })

    it('should add Everyone user_segment instance', async () => {
      await filter.onFetch(elements)
      const fetchedEveryoneUserSegment = elements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === EVERYONE_USER_TYPE)
      expect(elements).toHaveLength(2)
      expect(fetchedEveryoneUserSegment?.value).toEqual(everyoneUserSegmentInstance.value)
    })
  })
})
