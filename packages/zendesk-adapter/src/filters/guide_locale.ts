/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { FETCH_CONFIG, isGuideEnabled } from '../config'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME, BRAND_TYPE_NAME, CATEGORY_TRANSLATION_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, SECTION_TRANSLATION_TYPE_NAME,
  SECTION_TYPE_NAME,
} from '../constants'

const log = logger(module)

const TYPES_WITH_SOURCE_LOCALE = [ARTICLE_TYPE_NAME, SECTION_TYPE_NAME, CATEGORY_TYPE_NAME]
const TYPES_WITH_LOCALE = [
  ...TYPES_WITH_SOURCE_LOCALE,
  SECTION_TRANSLATION_TYPE_NAME, CATEGORY_TRANSLATION_TYPE_NAME, ARTICLE_TRANSLATION_TYPE_NAME,
]


/**
 * Converts locale fields to ReferenceExpression of the correct guide_language_settings by brand
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'guideLocalesFilter',
  onFetch: async elements => {
    if (!isGuideEnabled(config[FETCH_CONFIG])) {
      return
    }

    const instances = elements.filter(isInstanceElement)

    const brands = instances.filter(i => i.elemID.typeName === BRAND_TYPE_NAME)
    const guideLanguageSettings = instances.filter(i => i.elemID.typeName === GUIDE_LANGUAGE_SETTINGS_TYPE_NAME)
    const instancesWithLocale = instances.filter(i => TYPES_WITH_LOCALE.includes(i.elemID.typeName))

    // Brand to <locale string to locale instance>
    const brandToLocale: Record<number, Record<string, InstanceElement>> = {}
    guideLanguageSettings.forEach(settings => {
      brandToLocale[settings.value.brand] = brandToLocale[settings.value.brand] ?? {} // Init inner dict if needed
      brandToLocale[settings.value.brand][settings.value.locale] = settings
    })

    instancesWithLocale.forEach(instance => {
      const brandLocales = brandToLocale[instance.value.brand] ?? {}
      const locale = brandLocales[instance.value.locale]
      const brandName = brands.find(b => b.value.id === instance.value.brand)?.elemID.name

      if (locale !== undefined) {
        instance.value.locale = new ReferenceExpression(locale.elemID, locale)
      } else {
        log.error(`Could not find '${instance.value.locale}' ${GUIDE_LANGUAGE_SETTINGS_TYPE_NAME} of brand ${brandName}`)
      }

      if (TYPES_WITH_SOURCE_LOCALE.includes(instance.elemID.typeName)) {
        const sourceLocale = brandLocales[instance.value.source_locale]
        if (sourceLocale !== undefined) {
          instance.value.source_locale = new ReferenceExpression(sourceLocale.elemID, sourceLocale)
        } else {
          log.error(`Could not find '${instance.value.source_locale}' ${GUIDE_LANGUAGE_SETTINGS_TYPE_NAME} of brand ${brandName}`)
        }
      }
    })
  },
})

export default filterCreator
