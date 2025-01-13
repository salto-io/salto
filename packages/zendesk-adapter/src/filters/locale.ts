/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  isInstanceElement,
  Element,
  SaltoError,
  getChangeData,
  InstanceElement,
  Change,
  isAdditionOrRemovalChange,
  createSaltoElementErrorFromError,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { LOCALE_TYPE_NAME } from '../constants'

const log = logger(module)

const getWarningsForLocale = (): SaltoError[] => {
  const message =
    "Please be aware that your Zendesk account's default locale is not set to English (en-US), which may impact your ability to compare environments with different default locales"
  return [
    {
      message,
      detailedMessage: message,
      severity: 'Warning',
    },
  ]
}

/**
 * This filter checks that the default locale is set to en-US, if not it will raise a warning. We have seen that the
 * default locale determines the language of different values and therefore may affect the elemId. This can cause
 * elements to unintentionally appear as removed/added when comparing environments
 *
 * in the deploy, this filter adds and deletes locales through the account settings endpoint. zendesk does not support
 * modifications
 */
const filterCreator: FilterCreator = ({ elementSource, client }) => ({
  name: 'locale',
  onFetch: async (elements: Element[]) => {
    const defaultLocale = elements
      .filter(isInstanceElement)
      .filter(obj => obj.elemID.typeName === LOCALE_TYPE_NAME)
      .find(localeInstance => localeInstance.value.default === true)

    if (defaultLocale === undefined) {
      log.warn('could not find a default locale')
      return { errors: [] }
    }

    const warnings = defaultLocale.value.locale === 'en-US' ? [] : getWarningsForLocale()
    return { errors: warnings }
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [localeChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === LOCALE_TYPE_NAME,
    )
    if (localeChanges.length === 0) {
      return {
        leftoverChanges,
        deployResult: {
          errors: [],
          appliedChanges: [],
        },
      }
    }

    const [removalAndAdditionsChanges, modificationChanges] = _.partition(localeChanges, isAdditionOrRemovalChange)
    const modificationErrors = modificationChanges.map(change => {
      const message = `Failed to update ${getChangeData(change).elemID.getFullName()} since modification of locale is not supported by Zendesk`
      return {
        message,
        detailedMessage: message,
        severity: 'Error' as SeverityLevel,
        elemID: getChangeData(change).elemID,
      }
    })

    if (removalAndAdditionsChanges.length === 0) {
      return {
        leftoverChanges,
        deployResult: {
          errors: modificationErrors,
          appliedChanges: [],
        },
      }
    }

    // we do not need the actual changes as we send the entire list of locales
    const allLocales = await getInstancesFromElementSource(elementSource, [LOCALE_TYPE_NAME])
    const localeIds = allLocales
      .filter(locale => {
        if (locale.value.id === undefined) {
          // shouldn't happen
          log.warn(`locale ${locale.elemID} does not have an id`)
          return false
        }
        return true
      })
      .map(locale => locale.value.id)
    try {
      await client.put({
        url: '/api/v2/account/settings',
        data: {
          settings: {
            localization: {
              locale_ids: localeIds,
            },
          },
        },
      })
    } catch (e) {
      const additionAndRemovalErrors = removalAndAdditionsChanges.map(change =>
        createSaltoElementErrorFromError({
          error: e,
          severity: 'Error' as SeverityLevel,
          elemID: getChangeData(change).elemID,
        }),
      )
      return {
        leftoverChanges,
        deployResult: {
          errors: modificationErrors.concat(additionAndRemovalErrors),
          appliedChanges: [],
        },
      }
    }

    return {
      leftoverChanges,
      deployResult: {
        errors: modificationErrors,
        appliedChanges: removalAndAdditionsChanges,
      },
    }
  },
})
export default filterCreator
