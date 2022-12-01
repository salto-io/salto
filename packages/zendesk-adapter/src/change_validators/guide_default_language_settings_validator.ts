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
  Change, ChangeDataType,
  ChangeError, ChangeValidator, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange,
  isRemovalOrModificationChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { GUIDE_LANGUAGE_SETTINGS_TYPE_NAME } from '../constants'

const { isDefined } = values

// Sort the default language changes by brand, split into those who were added as default and those who were removed
const sortDefaultLanguageChanges = (changes: Change<InstanceElement>[])
    : Record<string, { add: Change[]; remove: Change[] }> => {
  const brandToChanges: Record<string, { add: Change[]; remove: Change[] }> = {}
  changes.forEach(change => {
    const beforeValue = isRemovalOrModificationChange(change) ? change.data.before.value : undefined
    const afterValue = isAdditionOrModificationChange(change) ? change.data.after.value : undefined

    // Init the dict key-value in case it's the first change of this brand
    const brandName = beforeValue?.brand.elemID.name ?? afterValue?.brand.elemID.name
    brandToChanges[brandName] = {
      add: brandToChanges[brandName] ? brandToChanges[brandName].add : [],
      remove: brandToChanges[brandName] ? brandToChanges[brandName].remove : [],
    }

    // Was default and now not - removed
    if (beforeValue?.default === true && afterValue?.default === false) {
      brandToChanges[brandName].remove.push(change)
    // Was not default and now yes - added
    } else if (beforeValue?.default === false && afterValue?.default === true) {
      brandToChanges[brandName].add.push(change)
    }
  })

  return brandToChanges
}

const createTooManyDefaultsErrors = (addChanges: ChangeDataType[], brand: string): ChangeError[] => addChanges.map(
  change => ({
    elemID: change.elemID,
    severity: 'Error',
    message: 'Invalid amount of default languages of a brand, there must be exactly one default language',
    detailedMessage: `Too many default languages were added for brand '${brand}'. (${addChanges.map(addChange => addChange.elemID.name)})`,
  })
)

/**
 * Validates that there is only one default language per brand ( count(removed defaults) == count(added defaults) )
 * count(removed defaults) can be either 0 or 1, since there is only 1 default language on fetch
*/
export const defaultLanguageSettingsValidator: ChangeValidator = async changes => {
  // If there was no language settings change, there is nothing to do
  const defaultLanguageChanges = changes.filter(isInstanceChange)
    .filter(change => GUIDE_LANGUAGE_SETTINGS_TYPE_NAME.includes(getChangeData(change).elemID.typeName))

  const brandToChanges = sortDefaultLanguageChanges(defaultLanguageChanges)

  return Object.entries(brandToChanges).flatMap(([brand, defaultChanges]): ChangeError[] | undefined => {
    // Impossible to set more than 1 default languages
    if (defaultChanges.add.length > 1) {
      return createTooManyDefaultsErrors(defaultChanges.add.map(getChangeData), brand)
    }
    // Impossible to add a default language without removing the previous
    if (defaultChanges.add.length === 1 && defaultChanges.remove.length === 0) {
      const changeElement = getChangeData(defaultChanges.add[0])
      return [{
        elemID: changeElement.elemID,
        severity: 'Error',
        message: 'Invalid amount of default languages of a brand, there must be exactly one default language',
        detailedMessage: `A default language (${changeElement.elemID.name}) was added for brand '${brand}', but no default language was removed.`,
      }]
    }
    // Impossible to remove the default language without settings a new once
    if (defaultChanges.add.length === 0 && defaultChanges.remove.length === 1) {
      const changeElement = getChangeData(defaultChanges.remove[0])
      return [{
        elemID: changeElement.elemID,
        severity: 'Error',
        message: 'Invalid amount of default languages of a brand, there must be exactly one default language',
        detailedMessage: `A default language (${changeElement.elemID.name}) was removed from brand '${brand}', but no default language was added.`,
      }]
    }
    return undefined
  }).filter(isDefined)
}
