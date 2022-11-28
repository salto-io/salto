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
import { BRAND_TYPE_NAME, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const { isDefined } = values
const log = logger(module)

// If there is not exactly one default, create a relevant error and return it
const validateOnlyOneDefault = (
  brand: InstanceElement,
  settings: InstanceElement[],
): ChangeError | undefined => {
  const defaultSettings = settings.filter(s => s.value.default)
  if (defaultSettings.length === 0) {
    return {
      elemID: brand.elemID,
      severity: 'Error',
      message: 'Invalid amount of default languages of a brand',
      detailedMessage: `There are 0 default languages for brand '${brand.elemID.name}', there must be exactly 1`,
    }
  }
  if (defaultSettings.length > 1) {
    return {
      elemID: brand.elemID,
      severity: 'Error',
      message: 'Invalid amount of default languages of a brand',
      detailedMessage: `There are ${defaultSettings.length} default languages for brand '${brand.elemID.name}', there must be exactly 1. The defaults are: ${defaultSettings.map(ds => ds.elemID.name)}`,
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

  const brandsByName = Object.assign({}, ...(await awu(await elementsSource.list())
    .filter(id => id.typeName === BRAND_TYPE_NAME && id.idType === 'instance')
    .map(id => elementsSource.get(id)).filter(isInstanceElement)
    .toArray()).map(brand => ({ [brand.elemID.name]: brand })))

  const brandToLanguageSettings = _.groupBy(languageSettings, settings => settings.value.brand.elemID.name)

  return Object.entries(brandToLanguageSettings)
    .map(([brandName, settings]) => validateOnlyOneDefault(brandsByName[brandName], settings)).filter(isDefined)
}
