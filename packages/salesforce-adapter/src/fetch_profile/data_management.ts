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
import { DataManagementConfig, DATA_CONFIGURATION } from '../types'

const { makeArray } = collections.array


export type DataManagement = {
  isObjectMatch: (name: string) => boolean
  isReferenceAllowed: (name: string) => boolean
  getObjectIdsFields: (name: string) => string[]
}

export const buildDataManagement = (params: DataManagementConfig): DataManagement => (
  {
    isObjectMatch: name => params.includeObjects.some(re => new RegExp(`^${re}$`).test(name))
      && !params.excludeObjects?.some(re => new RegExp(re).test(name)),

    isReferenceAllowed: name => params.allowReferenceTo?.some(re => new RegExp(`^${re}$`).test(name))
      ?? false,

    getObjectIdsFields: name => {
      const matchedOverride = params.saltoIDSettings.overrides
        ?.find(override => new RegExp(override.objectsRegex).test(name))
      return matchedOverride?.idFields ?? params.saltoIDSettings.defaultIdFields
    },
  }
)

const validateRegexes = (fieldPath: string[], regexes: string[]): void => {
  try {
    validateRegularExpressions(regexes)
  } catch (e) {
    if (e instanceof ConfigValidationError) {
      e.fieldPath.unshift(DATA_CONFIGURATION, ...fieldPath)
    }
    throw e
  }
}

export const validateDataManagementConfig = (dataManagementConfig: Partial<DataManagementConfig>):
  void => {
  if (dataManagementConfig.includeObjects === undefined) {
    throw new ConfigValidationError([DATA_CONFIGURATION, 'includeObjects'], 'includeObjects is required when dataManagement is configured')
  }
  if (dataManagementConfig.saltoIDSettings === undefined) {
    throw new ConfigValidationError([DATA_CONFIGURATION, 'saltoIDSettings'], 'saltoIDSettings is required when dataManagement is configured')
  }
  if (dataManagementConfig.saltoIDSettings.defaultIdFields === undefined) {
    throw new ConfigValidationError([DATA_CONFIGURATION, 'saltoIDSettings', 'defaultIdFields'], 'saltoIDSettings.defaultIdFields is required when dataManagement is configured')
  }
  validateRegexes(['includeObjects'], makeArray(dataManagementConfig.includeObjects))
  validateRegexes(['excludeObjects'], makeArray(dataManagementConfig.excludeObjects))
  validateRegexes(['allowReferenceTo'], makeArray(dataManagementConfig.allowReferenceTo))
  if (dataManagementConfig.saltoIDSettings.overrides !== undefined) {
    const overridesObjectRegexs = dataManagementConfig.saltoIDSettings.overrides
      .map(override => override.objectsRegex)
    validateRegexes(['saltoIDSettings', 'overrides'], overridesObjectRegexs)
  }
}
