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
// Notice that the settings for this 'source' does not exist - so it should stay the same
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
