/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { detailedCompare } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { FETCH_CONFIG, isGuideEnabled } from '../config'
import { GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, GUIDE_SETTINGS_TYPE_NAME } from '../constants'
import { getZendeskError } from '../errors'
import { deployChange, deployChanges } from '../deployment'
import { getBrandsForGuide } from './utils'

const log = logger(module)
const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues

export const DEFAULT_LOCALE_API = '/hc/api/internal/default_locale'
const DEFAULT_LOCALE = 'default_locale'

/**
 On fetch - Add 'default_locale' field for guide_settings from an url request
 On deploy - send and api request to update the default language if it was changed
 */
const filterCreator: FilterCreator = ({ config, oldApiDefinitions, client, brandIdToClient = {}, definitions }) => ({
  name: 'guideDefaultLanguage',
  onFetch: async elements => {
    if (!isGuideEnabled(config[FETCH_CONFIG])) {
      return
    }
    const instances = elements.filter(isInstanceElement)

    const guideSettings = instances.filter(e => e.elemID.typeName === GUIDE_SETTINGS_TYPE_NAME)
    const guideLanguageSettings = instances.filter(e => e.elemID.typeName === GUIDE_LANGUAGE_SETTINGS_TYPE_NAME)
    const brands = getBrandsForGuide(instances, config[FETCH_CONFIG])

    // Request the default locale for each brand and fill up the brand's language info
    const brandsLanguageInfo = await awu(brands)
      .map(async brand => {
        const brandId = brand.value.id
        try {
          const res = await brandIdToClient[brandId].get({ url: DEFAULT_LOCALE_API })
          return {
            brandName: brand.elemID.name,
            defaultLocale: res.data.toString(),
            settings: guideSettings.find(settings => settings.value.brand === brandId),
            languageSettings: guideLanguageSettings.filter(settings => settings.value.brand === brandId),
          }
        } catch {
          log.error(`Failed requesting default locale for brand '${brand.elemID.name}'`)
          return undefined
        }
      })
      .filter(isDefined)
      .toArray()

    brandsLanguageInfo.forEach(brandLanguageInfo => {
      const { brandName, defaultLocale, settings, languageSettings } = brandLanguageInfo
      const defaultLanguageSettings = languageSettings.find(setting => setting.value.locale === defaultLocale)

      // These shouldn't happen, but is needed for type casting
      if (settings === undefined) {
        log.error(`Missing ${GUIDE_SETTINGS_TYPE_NAME} for brand ${brandName}`)
        return
      }
      if (defaultLanguageSettings === undefined) {
        log.error(`Missing ${GUIDE_LANGUAGE_SETTINGS_TYPE_NAME} of locale ${defaultLocale} for brand ${brandName}`)
        return
      }

      settings.value[DEFAULT_LOCALE] = new ReferenceExpression(defaultLanguageSettings.elemID, defaultLanguageSettings)
    })
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [guideSettingsChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === GUIDE_SETTINGS_TYPE_NAME,
    )

    // Removal and Addition isn't possible because we don't allow activation of Guide with Salto (SALTO-2914)
    const deployResults = await awu(guideSettingsChanges)
      .filter(isModificationChange)
      .map(async change => {
        const defaultChanged = change.data.before.value[DEFAULT_LOCALE] !== change.data.after.value[DEFAULT_LOCALE]

        if (defaultChanged) {
          try {
            await client.put({
              url: DEFAULT_LOCALE_API,
              data: { locale: getChangeData(change).value[DEFAULT_LOCALE] },
            })

            // If there was only default locale change, there is no reason do call deployChange
            const detailedChanges = detailedCompare(change.data.before, change.data.after)
            if (detailedChanges.every(c => c.id.name === DEFAULT_LOCALE)) {
              return { appliedChanges: [change] }
            }
          } catch (err) {
            // If changing the default failed, don't continue
            return { errors: [getZendeskError(getChangeData(change).elemID, err)] }
          }
        }

        return deployChanges(
          [change],
          // Deploying with the default_locale field does nothing, but we ignore it for safety
          async c => {
            await deployChange({
              change: c,
              client,
              apiDefinitions: oldApiDefinitions,
              definitions,
              fieldsToIgnore: [DEFAULT_LOCALE],
            })
          },
        )
      })
      .toArray()

    return {
      deployResult: Object.assign({}, ...deployResults),
      leftoverChanges,
    }
  },
})

export default filterCreator
