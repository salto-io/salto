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
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockClient } from '../utils'
import avatarsFilter from '../../src/filters/avatars'
import { Filter } from '../../src/filter'
import { DEFAULT_CONFIG } from '../../src/config'
import { JIRA } from '../../src/constants'

describe('avatarsFilter', () => {
  let filter: Filter
  let type: ObjectType
  beforeEach(async () => {
    const { client, paginator } = mockClient()

    filter = avatarsFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
      elementsSource: buildElementsSourceFromElements([]),
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'type'),
    })
  })

  describe('onFetch', () => {
    it('should add the avatarId field if there is iconUrl field', async () => {
      type.fields.iconUrl = new Field(type, 'iconUrl', BuiltinTypes.STRING)
      await filter.onFetch?.([type])
      expect(type.fields.avatarId).toBeDefined()
    })

    it('should add the avatarId field if there is avatarUrls field', async () => {
      type.fields.avatarUrls = new Field(type, 'avatarUrls', BuiltinTypes.STRING)
      await filter.onFetch?.([type])
      expect(type.fields.avatarId).toBeDefined()
    })

    it('should do nothing if there are not avatar fields', async () => {
      await filter.onFetch?.([type])
      expect(type.fields.avatarId).toBeUndefined()
    })

    it('should extract id from url', async () => {
      const iconInstance = new InstanceElement(
        'instance',
        type,
        {
          iconUrl: 'https://ori-salto-test.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10303?size=medium',
        }
      )

      const avatarsInstance = new InstanceElement(
        'instance',
        type,
        {
          avatarUrls: {
            '48x48': 'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303',
            '24x24': 'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303?size=small',
            '16x16': 'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303?size=xsmall',
            '32x32': 'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303?size=medium',
          },
        }
      )

      await filter.onFetch?.([iconInstance, avatarsInstance])

      expect(iconInstance.value).toEqual({
        avatarId: 10303,
      })

      expect(avatarsInstance.value).toEqual({
        avatarId: 10303,
      })
    })

    it('if url does not contain an id should remove the domain prefix', async () => {
      const iconInstance = new InstanceElement(
        'instance',
        type,
        {
          iconUrl: 'https://ori-salto-test.atlassian.net/images/icons/priorities/low.svg?size=medium',
        }
      )

      const avatarsInstance = new InstanceElement(
        'instance',
        type,
        {
          avatarUrls: {
            '48x48': 'https://ori-salto-test.atlassian.net/images/icons/priorities/low.svg',
            '24x24': 'https://ori-salto-test.atlassian.net/images/icons/priorities/low.svg?size=small',
            '16x16': 'https://ori-salto-test.atlassian.net/images/icons/priorities/low.svg?size=xsmall',
            '32x32': 'https://ori-salto-test.atlassian.net/images/icons/priorities/low.svg?size=medium',
          },
        }
      )

      await filter.onFetch?.([iconInstance, avatarsInstance])

      expect(iconInstance.value).toEqual({
        iconUrl: '/images/icons/priorities/low.svg?size=medium',
      })

      expect(avatarsInstance.value).toEqual({
        avatarUrls: {
          '48x48': '/images/icons/priorities/low.svg',
          '24x24': '/images/icons/priorities/low.svg?size=small',
          '16x16': '/images/icons/priorities/low.svg?size=xsmall',
          '32x32': '/images/icons/priorities/low.svg?size=medium',
        },
      })
    })

    it('if url does not start with the domain prefix should not change it', async () => {
      const iconInstance = new InstanceElement(
        'instance',
        type,
        {
          iconUrl: 'https://other/images/icons/priorities/low.svg?size=medium',
        }
      )

      const avatarsInstance = new InstanceElement(
        'instance',
        type,
        {
          avatarUrls: {
            '48x48': 'https://other/images/icons/priorities/low.svg',
            '24x24': 'https://other/images/icons/priorities/low.svg?size=small',
            '16x16': 'https://other/images/icons/priorities/low.svg?size=xsmall',
            '32x32': 'https://other/images/icons/priorities/low.svg?size=medium',
          },
        }
      )

      await filter.onFetch?.([iconInstance, avatarsInstance])

      expect(iconInstance.value).toEqual({
        iconUrl: 'https://other/images/icons/priorities/low.svg?size=medium',
      })

      expect(avatarsInstance.value).toEqual({
        avatarUrls: {
          '48x48': 'https://other/images/icons/priorities/low.svg',
          '24x24': 'https://other/images/icons/priorities/low.svg?size=small',
          '16x16': 'https://other/images/icons/priorities/low.svg?size=xsmall',
          '32x32': 'https://other/images/icons/priorities/low.svg?size=medium',
        },
      })
    })

    it('if instance already have avatarId should not replace it', async () => {
      const iconInstance = new InstanceElement(
        'instance',
        type,
        {
          iconUrl: 'https://ori-salto-test.atlassian.net/images/icons/priorities/low.svg?size=medium',
          avatarId: 1,
        }
      )

      const avatarsInstance = new InstanceElement(
        'instance',
        type,
        {
          avatarUrls: {
            '48x48': 'https://ori-salto-test.atlassian.net/images/icons/priorities/low.svg',
            '24x24': 'https://ori-salto-test.atlassian.net/images/icons/priorities/low.svg?size=small',
            '16x16': 'https://ori-salto-test.atlassian.net/images/icons/priorities/low.svg?size=xsmall',
            '32x32': 'https://ori-salto-test.atlassian.net/images/icons/priorities/low.svg?size=medium',
          },
          avatarId: 1,
        }
      )

      await filter.onFetch?.([iconInstance, avatarsInstance])

      expect(iconInstance.value).toEqual({
        avatarId: 1,
      })

      expect(avatarsInstance.value).toEqual({
        avatarId: 1,
      })
    })
  })
})
