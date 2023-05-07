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
import { collections, types } from '@salto-io/lowerdash'
import { ConfigValidationError, validateRegularExpressions } from '../config_validation'
import { DataManagementConfig } from '../types'
import { DETECTS_PARENTS_INDICATOR } from '../constants'

const { makeArray } = collections.array

const defaultIgnoreReferenceTo = ['User']

export type DataManagement = {
  isObjectMatch: (name: string) => boolean
  isReferenceAllowed: (name: string) => boolean
  shouldIgnoreReference: (name: string) => boolean
  getObjectIdsFields: (name: string) => string[]
  getObjectAliasFields: (name: string) => types.NonEmptyArray<string>
  showReadOnlyValues?: boolean
}


const DEFAULT_ALIAS_FIELDS: types.NonEmptyArray<string> = [DETECTS_PARENTS_INDICATOR, 'Name']
const ALIAS_FIELDS_BY_TYPE: Record<string, types.NonEmptyArray<string>> = {
  SBQQ__ProductFeature__c: [
    DETECTS_PARENTS_INDICATOR,
    'SBQQ__ConfiguredSKU__c',
    'Name',
  ],
  SBQQ__LineColumn__c: [
    DETECTS_PARENTS_INDICATOR,
    'SBQQ__FieldName__c',
    'Name',
  ],
  SBQQ__LookupQuery__c: [
    DETECTS_PARENTS_INDICATOR,
    'SBQQ__PriceRule2__c',
    'Name',
  ],
  SBQQ__Dimension__c: [
    DETECTS_PARENTS_INDICATOR,
    'SBQQ__Product__c',
    'Name',
  ],
  PricebookEntry: [
    'Pricebook2Id',
    'Name',
  ],
  Product2: [
    'ProductCode',
    'Family',
    'Name',
  ],
  sbaa__ApprovalCondition__c: [
    'sbaa__ApprovalRule__c',
    'sbaa__Index__c',
  ],
}

export const buildDataManagement = (params: DataManagementConfig): DataManagement => (
  {
    isObjectMatch: name => params.includeObjects.some(re => new RegExp(`^${re}$`).test(name))
      && !params.excludeObjects?.some(re => new RegExp(`^${re}$`).test(name)),

    isReferenceAllowed: name => params.allowReferenceTo?.some(re => new RegExp(`^${re}$`).test(name))
      ?? false,

    shouldIgnoreReference: name =>
      (params.ignoreReferenceTo ?? defaultIgnoreReferenceTo).includes(name),

    getObjectIdsFields: name => {
      const matchedOverride = params.saltoIDSettings.overrides
        ?.find(override => new RegExp(`^${override.objectsRegex}$`).test(name))
      return matchedOverride?.idFields ?? params.saltoIDSettings.defaultIdFields
    },
    getObjectAliasFields: name => ALIAS_FIELDS_BY_TYPE[name] ?? DEFAULT_ALIAS_FIELDS,
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
