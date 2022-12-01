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
  InstanceElement, isAdditionChange, isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement, isModificationChange,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { FETCH_CONFIG } from '../config'
import { BRAND_TYPE_NAME, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME } from '../constants'
import { deployChange, deployChanges } from '../deployment'
import { getZendeskError } from '../errors'

const DEFAULT_LOCALE_API = '/hc/api/internal/default_locale'

/**
 On fetch - Add 'default' field for guide_language_settings from an url request
 On deploy - ignore the field
 */
const filterCreator: FilterCreator = ({ config, client, brandIdToClient = {} }) => ({
  onFetch: async elements => {
    if (!config[FETCH_CONFIG].enableGuide) {
      return
    }
    const instances = elements.filter(isInstanceElement)

    const brands = instances
      .filter(e => e.elemID.typeName === BRAND_TYPE_NAME)
      .filter(b => b.value.has_help_center === true)

    const brandToDefaultTranslation: Record<number, clientUtils.ResponseValue | clientUtils.ResponseValue[]> = {}

    // Request the default locale for each brand
    const defaultLocaleRequestPromises = brands.map(async brand => {
      const brandId = brand.value.id
      const res = await brandIdToClient[brandId].getSinglePage({ url: DEFAULT_LOCALE_API })
      brandToDefaultTranslation[brandId] = res.data
    })

    // Do all requests parallel to save time
    await Promise.all(defaultLocaleRequestPromises)

    // If the language of the setting is the same as the default, mark it as true
    const guideLanguageSettings = instances.filter(e => e.elemID.typeName === GUIDE_LANGUAGE_SETTINGS_TYPE_NAME)
    guideLanguageSettings.forEach(settings => {
      settings.value.default = brandToDefaultTranslation[settings.value.brand.value.value.id] === settings.value.locale
    })
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [guideLanguageSettingsChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
            && GUIDE_LANGUAGE_SETTINGS_TYPE_NAME.includes(getChangeData(change).elemID.typeName),
    )

    const deployResult = await deployChanges(
      guideLanguageSettingsChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions, ['default']) // Deploying with this field doesn't seem to do anything, but we ignore it to be safe
      }
    )

    const newDefaultChange = guideLanguageSettingsChanges.filter(isAdditionOrModificationChange).find(change => {
      if (getChangeData(change).value.default === true) {
        // Addition change needs to be updated, modification only updates if it changed from false to true
        if (isAdditionChange(change) || (isModificationChange(change) && change.data.before.value.default === false)) {
          return true
        }
      }
      return false
    })

    // If there was a change of the default language, send an api request to update it
    if (newDefaultChange !== undefined) {
      const newDataValue = newDefaultChange.data.after.value
      try {
        await client.put({
          url: DEFAULT_LOCALE_API,
          data: { locale: newDataValue.locale },
        })
      } catch (err) {
        const zendeskError = getZendeskError(getChangeData(newDefaultChange).elemID.getFullName(), err)
        deployResult.errors = [...deployResult.errors, zendeskError]
      }
    }


    return {
      deployResult,
      leftoverChanges,
    }
  },
})

export default filterCreator
