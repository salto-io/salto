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
  ChangeError, ChangeValidator, getChangeData, InstanceElement,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { GUIDE_LANGUAGE_SETTINGS_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const { isDefined } = values
const log = logger(module)

// If there is not exactly one default, create a relevant error a d return it
const validateOnlyOneDefault = (settings: InstanceElement[]): ChangeError | undefined => {
  if (settings.length === 0) {
    return {
      elemID: settings[0].elemID, // TODO: ?
      severity: 'Error',
      message: 'Brand does not have any default language',
      detailedMessage: '',
    }
  }
  if (settings.length > 1) {
    return {
      elemID: settings[0].elemID,
      severity: 'Error',
      message: 'Brand does not have exactly one default language',
      detailedMessage: '',
    }
  }
  return undefined
}

/**
 * Validates that all the elements in the articles order list are references
*/
export const defaultLanguageSettingsValidator: ChangeValidator = async (changes, elementsSource) => {
  // If there was no language settings change, there is nothing to do
  if (!changes.some(change => GUIDE_LANGUAGE_SETTINGS_TYPE_NAME.includes(getChangeData(change).elemID.typeName))) {
    return []
  }
  if (elementsSource === undefined) {
    log.warn('Elements source was not passed to defaultLanguageSettingsValidator. Skipping validator')
    return []
  }

  const languageSettings = await awu(await elementsSource.list())
    .filter(id => id.typeName === GUIDE_LANGUAGE_SETTINGS_TYPE_NAME && id.idType === 'instance')
    .map(id => elementsSource.get(id)).filter(isInstanceElement)
    .toArray()

  const brandToDefaultLanguageSettings = _.groupBy(
    languageSettings.filter(settings => settings.value.default),
    settings => settings.value.brand
  )

  return Object.values(brandToDefaultLanguageSettings).map(validateOnlyOneDefault).filter(isDefined)
}
