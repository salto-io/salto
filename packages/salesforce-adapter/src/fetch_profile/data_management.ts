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
import { ObjectType } from '@salto-io/adapter-api'
import { ConfigValidationError, validateRegularExpressions } from '../config_validation'
import { DataManagementConfig } from '../types'
import { DETECTS_PARENTS_INDICATOR } from '../constants'
import { apiName } from '../transformers/transformer'

const { makeArray } = collections.array

const defaultIgnoreReferenceTo = ['User']

export type TypeFetchCategory = 'Always' | 'IfReferenced' | 'Never'

export type DataManagement = {
  shouldFetchObjectType: (objectType: ObjectType) => Promise<TypeFetchCategory>
  isReferenceAllowed: (name: string) => boolean
  shouldIgnoreReference: (name: string) => boolean
  getObjectIdsFields: (name: string) => string[]
  getObjectAliasFields: (name: string) => types.NonEmptyArray<string>
  showReadOnlyValues?: boolean
  managedBySaltoFieldForType: (objType: ObjectType) => string | undefined
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

export const buildDataManagement = (params: DataManagementConfig): DataManagement => {
  const isReferenceAllowed = (name: string): boolean => (
    params.allowReferenceTo?.some(re => new RegExp(`^${re}$`).test(name)) ?? false
  )

  return {
    shouldFetchObjectType: async objectType => {
      /* See details in https://salto-io.atlassian.net/browse/SALTO-4579?focusedCommentId=97852 but the upshot is:
      - If we allow references and the type has the 'managed by Salto' field, always fetch instances that are managed
       by Salto (even if they are not referenced anywhere).
      - If we allow references to a type that has no 'managed by Salto' field, only fetch if there are references
       to the instance (even if it's excluded)
      - If the object is excluded, don't fetch it (even if it's explicitly included)
      - Finally, only fetch the Salto-managed instances if the object is explicitly included
      */
      const managedBySaltoFieldName = params.saltoManagementFieldSettings?.defaultFieldName
      const typeName = await apiName(objectType)
      const hasManagedBySaltoField = managedBySaltoFieldName !== undefined
        && objectType.fields[managedBySaltoFieldName] !== undefined
      const refsAllowed = isReferenceAllowed(typeName)
      const excluded = params.excludeObjects?.some(re => new RegExp(`^${re}$`).test(typeName)) ?? false
      const included = params.includeObjects?.some(re => new RegExp(`^${re}$`).test(typeName)) ?? false

      if (refsAllowed) {
        // we have to check all the 'refsAllowed' cases here because `refsAllowed` should take precedence over
        // `excluded`
        if (hasManagedBySaltoField || included) {
          return 'Always'
        }
        return 'IfReferenced'
      }

      if (excluded) {
        return 'Never'
      }

      if (included) {
        return 'Always'
      }

      return 'Never'
    },

    managedBySaltoFieldForType: objType => {
      if (params.saltoManagementFieldSettings?.defaultFieldName === undefined) {
        return undefined
      }
      if (objType.fields[params.saltoManagementFieldSettings.defaultFieldName] === undefined) {
        return undefined
      }
      return params.saltoManagementFieldSettings.defaultFieldName
    },

    isReferenceAllowed,

    shouldIgnoreReference: name =>
      (params.ignoreReferenceTo ?? defaultIgnoreReferenceTo).includes(name),

    getObjectIdsFields: name => {
      const matchedOverride = params.saltoIDSettings.overrides
        ?.find(override => new RegExp(`^${override.objectsRegex}$`).test(name))
      return matchedOverride?.idFields ?? params.saltoIDSettings.defaultIdFields
    },
    getObjectAliasFields: name => {
      const defaultFields = params.saltoAliasSettings?.defaultAliasFields ?? DEFAULT_ALIAS_FIELDS
      const matchedOverride = params.saltoAliasSettings?.overrides
        ?.find(override => new RegExp(`^${override.objectsRegex}$`).test(name))
      return matchedOverride !== undefined && types.isNonEmptyArray(matchedOverride.aliasFields)
        ? matchedOverride.aliasFields
        : ALIAS_FIELDS_BY_TYPE[name] ?? defaultFields
    },
    showReadOnlyValues: params.showReadOnlyValues,
  }
}

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
  const saltoAliasOverrides = dataManagementConfig.saltoAliasSettings?.overrides
  if (saltoAliasOverrides !== undefined) {
    validateRegularExpressions(
      saltoAliasOverrides.map(override => override.objectsRegex),
      [...fieldPath, 'saltoAliasSettings', 'overrides'],
    )
  }
}
