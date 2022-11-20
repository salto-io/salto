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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import filterCreator from '../../src/filters/guide_locale'
import { createFilterCreatorParams } from '../utils'

describe('guide locale filter', () => {
  let mockClient: MockInterface<ZendeskClient>
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const mockGetSinglePage = jest.fn()

  beforeEach(async () => {
    jest.clearAllMocks()
    mockClient = {
      getSinglePage: mockGetSinglePage,
    } as unknown as MockInterface<ZendeskClient>
    filter = filterCreator(createFilterCreatorParams({
      client: mockClient as unknown as ZendeskClient,
      config: {
        ...DEFAULT_CONFIG,
        [FETCH_CONFIG]: {
          ...DEFAULT_CONFIG[FETCH_CONFIG],
          enableGuide: true,
        },
      },
    })) as FilterType
  })

  describe('onFetch', () => {
    it('should add locales instances and type', async () => {
      const elements: Element[] = []
      mockGetSinglePage.mockResolvedValue({
        data: {
          locales: ['en-us', 'es'],
          default_locale: 'en-us',
        },
      })
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk.guide_locale',
          'zendesk.guide_locale.instance.en_us@b',
          'zendesk.guide_locale.instance.es',
        ])
      const locales = elements.filter(isInstanceElement)
      const enLocale = locales.find(locale => locale.value.id === 'en-us')
      expect(enLocale).toBeDefined()
      expect(enLocale?.value).toEqual({ id: 'en-us', default: true })
      const esLocale = locales.find(locale => locale.value.id === 'es')
      expect(esLocale).toBeDefined()
      expect(esLocale?.value).toEqual({ id: 'es', default: false })
    })
    it('should not add locales instances and type if enableGuide is false', async () => {
      const elements: Element[] = []
      mockGetSinglePage.mockResolvedValue({
        data: {
          locales: ['en-us', 'es'],
          default_locale: 'en-us',
        },
      })
      const filterWithNoGuide = filterCreator(createFilterCreatorParams({})) as FilterType
      await filterWithNoGuide.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([])
    })
    it('should not add locales if the response is invalid', async () => {
      const elements: Element[] = []
      mockGetSinglePage.mockResolvedValue({
        data: {
          invalid: ['en-us', 'es'],
        },
      })
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([])
    })
  })
})
