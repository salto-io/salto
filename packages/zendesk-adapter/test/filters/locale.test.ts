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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/locale'
import { LOCALE_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import { FilterResult } from '../../src/filter'
import ZendeskClient from '../../src/client/client'

describe('locale filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy', FilterResult>
  let filter: FilterType
  let mockPut: jest.SpyInstance

  const localeType = new ObjectType({ elemID: new ElemID(ZENDESK, LOCALE_TYPE_NAME) })
  const warningMsg =
    "Please be aware that your Zendesk account's default locale is not set to English (en-US), which may impact your ability to compare environments with different default locales"
  beforeEach(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
  })
  describe('onFetch', () => {
    beforeEach(async () => {
      filter = filterCreator(
        createFilterCreatorParams({
          client,
          elementsSource: buildElementsSourceFromElements([]),
        }),
      ) as FilterType
    })
    it('should add warning when default locale is not english', async () => {
      const enUsLocaleInstance = new InstanceElement('en US', localeType, {
        locale: 'en-US',
        default: false,
      })
      const heLocaleInstance = new InstanceElement('he', localeType, {
        locale: 'he',
        default: true,
      })

      const res = (await filter.onFetch([enUsLocaleInstance, heLocaleInstance])) as FilterResult
      expect(res.errors).toEqual([
        {
          message: warningMsg,
          severity: 'Warning',
        },
      ])
    })
    it('should not add warning when default locale is english', async () => {
      const enUsLocaleInstance = new InstanceElement('en US', localeType, {
        locale: 'en-US',
        default: true,
      })
      const heLocaleInstance = new InstanceElement('he', localeType, {
        locale: 'he',
        default: false,
      })

      const res = (await filter.onFetch([enUsLocaleInstance, heLocaleInstance])) as FilterResult
      expect(res.errors).toEqual([])
    })
  })
  describe('Deploy', () => {
    const enUsLocaleInstance = new InstanceElement('en US', localeType, {
      locale: 'en-US',
      id: 1,
    })
    const heLocaleInstance = new InstanceElement('he', localeType, {
      locale: 'he',
      id: 30,
    })
    const frLocaleInstance = new InstanceElement('he', localeType, {
      locale: 'fr',
      id: 1365,
    })
    beforeEach(async () => {
      jest.clearAllMocks()
      filter = filterCreator(
        createFilterCreatorParams({
          client,
          elementsSource: buildElementsSourceFromElements([enUsLocaleInstance, frLocaleInstance]),
        }),
      ) as FilterType
      mockPut = jest.spyOn(client, 'put')
    })
    it('should add and remove locales correctly', async () => {
      mockPut.mockResolvedValue({})
      const res = await filter.deploy([
        { action: 'add', data: { after: frLocaleInstance } },
        { action: 'remove', data: { before: heLocaleInstance } },
      ])
      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPut).toHaveBeenCalledWith({
        url: '/api/v2/account/settings',
        data: {
          settings: {
            localization: {
              locale_ids: [1, 1365],
            },
          },
        },
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
      expect(res.deployResult.appliedChanges).toEqual([
        { action: 'add', data: { after: frLocaleInstance } },
        { action: 'remove', data: { before: heLocaleInstance } },
      ])
    })
    it('should return error on modification', async () => {
      mockPut.mockResolvedValue({})
      const res = await filter.deploy([
        { action: 'modify', data: { before: frLocaleInstance, after: frLocaleInstance } },
      ])
      expect(mockPut).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.deployResult.errors).toEqual([
        {
          message: `Failed to update ${frLocaleInstance.elemID.getFullName()} since modification of locale is not supported by Zendesk`,
          severity: 'Error',
          elemID: frLocaleInstance.elemID,
        },
      ])
    })
    it('should return error if request throws error', async () => {
      mockPut.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([
        { action: 'add', data: { after: frLocaleInstance } },
        { action: 'remove', data: { before: heLocaleInstance } },
      ])
      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPut).toHaveBeenCalledWith({
        url: '/api/v2/account/settings',
        data: {
          settings: {
            localization: {
              locale_ids: [1, 1365],
            },
          },
        },
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(2)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.deployResult.errors).toEqual([
        {
          message: 'err',
          severity: 'Error',
          elemID: frLocaleInstance.elemID,
        },
        {
          message: 'err',
          severity: 'Error',
          elemID: heLocaleInstance.elemID,
        },
      ])
    })
  })
})
