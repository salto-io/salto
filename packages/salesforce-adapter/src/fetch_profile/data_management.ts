/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import { ConfigValidationError, validateRegularExpressions } from '../config_validation'
import { DataManagementConfig } from '../types'

const { makeArray } = collections.array


export type DataManagement = {
  isObjectMatch: (name: string) => boolean
  isReferenceAllowed: (name: string) => boolean
  getObjectIdsFields: (name: string) => string[]
  showReadOnlyValues?: boolean
}

export const buildDataManagement = (params: DataManagementConfig): DataManagement => (
  {
    isObjectMatch: name => params.includeObjects.some(re => new RegExp(`^${re}$`).test(name))
      && !params.excludeObjects?.some(re => new RegExp(`^${re}$`).test(name)),

    isReferenceAllowed: name => params.allowReferenceTo?.some(re => new RegExp(`^${re}$`).test(name))
      ?? false,

    getObjectIdsFields: name => {
      const matchedOverride = params.saltoIDSettings.overrides
        ?.find(override => new RegExp(`^${override.objectsRegex}$`).test(name))
      return matchedOverride?.idFields ?? params.saltoIDSettings.defaultIdFields
    },
    showReadOnlyValues: params.showReadOnlyValues,
  }
)

export const validateDataManagementConfig = (
  dataManagementConfig: Partial<DataManagementConfig>,
  fieldPath: string[],
):
  void => {
  if (dataManagementConfig.includeObjects === undefined) {
    throw new ConfigValidationError([...fieldPath, 'includeObjects'], 'includeObjects is required when dataManagement is configured')
  }
  if (dataManagementConfig.saltoIDSettings === undefined) {
    throw new ConfigValidationError([...fieldPath, 'saltoIDSettings'], 'saltoIDSettings is required when dataManagement is configured')
  }
  if (dataManagementConfig.saltoIDSettings.defaultIdFields === undefined) {
    throw new ConfigValidationError([...fieldPath, 'saltoIDSettings', 'defaultIdFields'], 'saltoIDSettings.defaultIdFields is required when dataManagement is configured')
  }
  validateRegularExpressions(makeArray(dataManagementConfig.includeObjects), [...fieldPath, 'includeObjects'])
  validateRegularExpressions(makeArray(dataManagementConfig.excludeObjects), [...fieldPath, 'excludeObjects'])
  validateRegularExpressions(makeArray(dataManagementConfig.allowReferenceTo), [...fieldPath, 'allowReferenceTo'])
  if (dataManagementConfig.saltoIDSettings.overrides !== undefined) {
    const overridesObjectRegexs = dataManagementConfig.saltoIDSettings.overrides
      .map(override => override.objectsRegex)
    validateRegularExpressions(overridesObjectRegexs, [...fieldPath, 'saltoIDSettings', 'overrides'])
  }
}
