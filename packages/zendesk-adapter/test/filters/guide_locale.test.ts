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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import guideLocaleFilter from '../../src/filters/guide_locale'
import { createFilterCreatorParams } from '../utils'
import {
  BRAND_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'

const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) })
const languageSettingsType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME) })
const categoryType = new ObjectType({ elemID: new ElemID(ZENDESK, CATEGORY_TYPE_NAME) })
const categoryTranslationType = new ObjectType({ elemID: new ElemID(ZENDESK, CATEGORY_TRANSLATION_TYPE_NAME) })

const brand1 = new InstanceElement('brand', brandType, { id: 1 })
const brand2 = new InstanceElement('brand', brandType, { id: 2 })

const languageSetting1 = new InstanceElement('settings1', languageSettingsType, { brand: 1, locale: 'en-us' })
const languageSetting2 = new InstanceElement('settings2', languageSettingsType, { brand: 2, locale: 'he' })

const category1 = new InstanceElement('category1', categoryType, { brand: 1, locale: 'en-us', source_locale: 'en-us' })
const category2 = new InstanceElement('category2', categoryType, { brand: 2, locale: 'en-us', source_locale: 'he' })

const categoryTranslation1 = new InstanceElement('translation1', categoryTranslationType, { brand: 1, locale: 'en-us' })
const categoryTranslation2 = new InstanceElement('translation2', categoryTranslationType, { brand: 2, locale: 'he' })

describe('onFetch', () => {
  const guideConfig = { ...DEFAULT_CONFIG }
  guideConfig[FETCH_CONFIG].enableGuide = true
  const filter = guideLocaleFilter(createFilterCreatorParams({ config: guideConfig })) as filterUtils.FilterWith<'onFetch'>
  it('should bla bla bla', async () => {
    await filter.onFetch([
      brand1, brand2, languageSetting1, languageSetting2,
      category1, category2, categoryTranslation1, categoryTranslation2,
    ])
    // eslint-disable-next-line no-console
    console.log(brand1)
  })
})

// describe('guide locale filter', () => {
//   let mockClient: MockInterface<ZendeskClient>
//   type FilterType = filterUtils.FilterWith<'onFetch'>
//   let filter: FilterType
//   const mockGetSinglePage = jest.fn()
//
//   beforeEach(async () => {
//     jest.clearAllMocks()
//     mockClient = {
//       getSinglePage: mockGetSinglePage,
//     } as unknown as MockInterface<ZendeskClient>
//     filter = filterCreator(createFilterCreatorParams({
//       client: mockClient as unknown as ZendeskClient,
//       config: {
//         ...DEFAULT_CONFIG,
//         [FETCH_CONFIG]: {
//           ...DEFAULT_CONFIG[FETCH_CONFIG],
//           enableGuide: true,
//         },
//       },
//     })) as FilterType
//   })
//
//   describe('onFetch', () => {
//     it('should add locales instances and type', async () => {
//       const elements: Element[] = []
//       mockGetSinglePage.mockResolvedValue({
//         data: {
//           locales: ['en-us', 'es'],
//           default_locale: 'en-us',
//         },
//       })
//       await filter.onFetch(elements)
//       expect(elements.map(e => e.elemID.getFullName()).sort())
//         .toEqual([
//           'zendesk.guide_locale',
//           'zendesk.guide_locale.instance.en_us@b',
//           'zendesk.guide_locale.instance.es',
//         ])
//       const locales = elements.filter(isInstanceElement)
//       const enLocale = locales.find(locale => locale.value.id === 'en-us')
//       expect(enLocale).toBeDefined()
//       expect(enLocale?.value).toEqual({ id: 'en-us', default: true })
//       const esLocale = locales.find(locale => locale.value.id === 'es')
//       expect(esLocale).toBeDefined()
//       expect(esLocale?.value).toEqual({ id: 'es', default: false })
//     })
//     it('should not add locales instances and type if enableGuide is false', async () => {
//       const elements: Element[] = []
//       mockGetSinglePage.mockResolvedValue({
//         data: {
//           locales: ['en-us', 'es'],
//           default_locale: 'en-us',
//         },
//       })
//       const filterWithNoGuide = filterCreator(createFilterCreatorParams({})) as FilterType
//       await filterWithNoGuide.onFetch(elements)
//       expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([])
//     })
//     it('should not add locales if the response is invalid', async () => {
//       const elements: Element[] = []
//       mockGetSinglePage.mockResolvedValue({
//         data: {
//           invalid: ['en-us', 'es'],
//         },
//       })
//       await filter.onFetch(elements)
//       expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([])
//     })
//   })
// })
