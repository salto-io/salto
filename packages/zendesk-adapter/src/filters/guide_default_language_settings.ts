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
  Change,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement, isModificationChange, ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { FETCH_CONFIG } from '../config'
import { BRAND_TYPE_NAME, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, GUIDE_SETTINGS_TYPE_NAME } from '../constants'
import { getZendeskError } from '../errors'

const { awu } = collections.asynciterable

export const DEFAULT_LOCALE_API = '/hc/api/internal/default_locale'

/**
 On fetch - Add 'default_locale' field for guide_settings from an url request
 On deploy - send and api request to update the default language if it was changed
 */
const filterCreator: FilterCreator = ({ config, client, brandIdToClient = {} }) => ({
  onFetch: async elements => {
    if (!config[FETCH_CONFIG].enableGuide) {
      return
    }
    const instances = elements.filter(isInstanceElement)

    const guideSettings = instances.filter(e => e.elemID.typeName === GUIDE_SETTINGS_TYPE_NAME)
    const guideLanguageSettings = instances.filter(e => e.elemID.typeName === GUIDE_LANGUAGE_SETTINGS_TYPE_NAME)
    const brands = instances
      .filter(e => e.elemID.typeName === BRAND_TYPE_NAME)
      .filter(b => b.value.has_help_center === true)

    // Request the default locale for each brand and fill up the brand's language info
    const brandToLanguageInfo = await awu(brands).map(async brand => {
      const brandId = brand.value.id
      const res = await brandIdToClient[brandId].getSinglePage({ url: DEFAULT_LOCALE_API })
      return {
        defaultLocale: res.data.toString(),
        settings: guideSettings.find(settings => settings.value.brand === brandId),
        languageSettings: guideLanguageSettings.filter(settings => settings.value.brand === brandId),
      }
    }).toArray()

    brandToLanguageInfo.forEach(languageInfo => {
      const { defaultLocale, settings, languageSettings } = languageInfo
      const defaultLanguageSettings = languageSettings.find(setting => setting.value.locale === defaultLocale)

      // This shouldn't happen, but is needed for type casting
      if (defaultLanguageSettings === undefined || settings === undefined) {
        return
      }

      settings.value.default_locale = new ReferenceExpression(defaultLanguageSettings.elemID, defaultLanguageSettings)
    })
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [guideSettingsChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === GUIDE_SETTINGS_TYPE_NAME
    )

    const errors: Error[] = []
    // Removal means nothing, addition isn't possible because we don't allow activation of Guide with Salto
    guideSettingsChanges.filter(isModificationChange).forEach(async change => {
      const defaultChanged = change.data.before.value.default_locale !== change.data.after.value.default_locale
      if (defaultChanged) {
        try {
          await client.put({
            url: DEFAULT_LOCALE_API,
            data: { locale: getChangeData(change).value.default_locale },
          })
        } catch (err) {
          errors.push(getZendeskError(getChangeData(change).elemID.getFullName(), err))
        }
      }
    })

    return {
      deployResult: {
        appliedChanges: [],
        errors,
      },
      leftoverChanges: [...leftoverChanges, ...guideSettingsChanges],
    }
  },
})

export default filterCreator
