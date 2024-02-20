/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { regex, strings, collections } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { isCustomRecordTypeName, netsuiteSupportedTypes } from '../types'
import { isRequiredFeature, removeRequiredFeatureSuffix } from '../client/utils'
import { ALL_TYPES_REGEX, ERROR_MESSAGE_PREFIX, SUITEAPP_ID_FORMAT_REGEX } from './constants'
import {
  AdditionalDependencies,
  AdditionalSdfDeployDependencies,
  CLIENT_CONFIG,
  CONFIG,
  ClientConfig,
  DEPLOY_PARAMS,
  DeployParams,
  FETCH_PARAMS,
  FetchParams,
  MaxInstancesPerType,
  NetsuiteConfig,
  NetsuiteQueryParameters,
  QUERY_PARAMS,
  QueryParams,
  SUITEAPP_CLIENT_CONFIG,
  SuiteAppClientConfig,
} from './types'
import { convertToQueryParams, isCriteriaQuery } from './query'

const log = logger(module)
const { makeArray } = collections.array

function validateArrayOfStrings(value: unknown, configPath: string | string[]): asserts value is string[] {
  if (!_.isArray(value) || !value.every(_.isString)) {
    throw new Error(`${makeArray(configPath).join('.')} should be a list of strings`)
  }
}

function validatePlainObject(
  value: NonNullable<unknown> | null,
  configPath: string | string[],
): asserts value is Record<string, unknown> {
  if (!_.isPlainObject(value)) {
    throw new Error(`${makeArray(configPath).join('.')} should be an object`)
  }
}

function validateDefined(value: unknown, configPath: string | string[]): asserts value is NonNullable<unknown> | null {
  if (value === undefined) {
    throw new Error(`${makeArray(configPath).join('.')} should be defined`)
  }
}

function validateBoolean(value: unknown, configPath: string | string[]): asserts value is boolean {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(
      `Expected "${makeArray(configPath).join('.')}" to be a boolean, but received:\n ${JSON.stringify(value, undefined, 4)}`,
    )
  }
}

function validateNumber(value: unknown, configPath: string | string[]): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== 'number') {
    throw new Error(
      `Expected "${makeArray(configPath).join('.')}" to be a number, but received:\n ${JSON.stringify(value, undefined, 4)}`,
    )
  }
}

const validateRegularExpressions = (regexes: string[], configPath: string | string[]): void => {
  const invalidRegexes = regexes.filter(strRegex => !regex.isValidRegex(strRegex))
  if (!_.isEmpty(invalidRegexes)) {
    const errMessage = `received an invalid ${makeArray(configPath).join('.')} value. The following regular expressions are invalid: ${invalidRegexes}`
    throw new Error(errMessage)
  }
}

const noSupportedTypeMatch = (name: string): boolean =>
  !netsuiteSupportedTypes.some(
    existTypeName =>
      regex.isFullRegexMatch(existTypeName, name) ||
      // This is to support the adapter configuration before the migration of
      // the SuiteApp type names from PascalCase to camelCase
      regex.isFullRegexMatch(strings.capitalizeFirstLetter(existTypeName), name),
  )

const isInvalidTypeQuery = (obj: Record<string, unknown>): boolean =>
  typeof obj.name !== 'string' || (obj.ids !== undefined && obj.criteria !== undefined)

const isInvalidIdsParam = (obj: Record<string, unknown>): boolean =>
  obj.ids !== undefined && (!Array.isArray(obj.ids) || obj.ids.some((id: unknown) => typeof id !== 'string'))

const isInvalidCriteriaParam = (obj: Record<string, unknown>): boolean =>
  obj.criteria !== undefined && (!_.isPlainObject(obj.criteria) || _.isEmpty(obj.criteria))

function validateFetchParameters(params: Partial<Record<keyof QueryParams, unknown>>): asserts params is QueryParams {
  const { types, fileCabinet, customRecords = [] } = params
  if (!Array.isArray(types) || !Array.isArray(fileCabinet) || !Array.isArray(customRecords)) {
    const typesErr = !Array.isArray(types) ? ' "types" field is expected to be an array\n' : ''
    const fileCabinetErr = !Array.isArray(fileCabinet) ? ' "fileCabinet" field is expected to be an array\n' : ''
    const customRecordsErr = !Array.isArray(customRecords) ? ' "customRecords" field is expected to be an array\n' : ''
    const message = `${ERROR_MESSAGE_PREFIX}${typesErr}${fileCabinetErr}${customRecordsErr}`
    throw new Error(message)
  }
  const corruptedTypeQueries = types.filter(isInvalidTypeQuery)
  if (corruptedTypeQueries.length !== 0) {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX} Expected the type name to be a string without both "ids" and "criteria", but found:\n${JSON.stringify(corruptedTypeQueries, null, 4)}.`,
    )
  }
  const corruptedTypesIds = types.filter(isInvalidIdsParam)
  if (corruptedTypesIds.length !== 0) {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX} Expected type "ids" to be an array of strings, but found:\n${JSON.stringify(corruptedTypesIds, null, 4)}}.`,
    )
  }
  const corruptedTypesCriteria = types.filter(isInvalidCriteriaParam)
  if (corruptedTypesCriteria.length !== 0) {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX} Expected type "criteria" to be a non-empty object, but found:\n${JSON.stringify(corruptedTypesCriteria, null, 4)}}.`,
    )
  }
  const corruptedCustomRecords = customRecords.filter(isInvalidTypeQuery)
  if (corruptedCustomRecords.length !== 0) {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX} Expected the custom record name to be a string without both "ids" and "criteria", but found:\n${JSON.stringify(corruptedCustomRecords, null, 4)}.`,
    )
  }
  const corruptedCustomRecordsIds = customRecords.filter(isInvalidIdsParam)
  if (corruptedCustomRecordsIds.length !== 0) {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX} Expected custom record "ids" to be an array of strings, but found:\n${JSON.stringify(corruptedCustomRecordsIds, null, 4)}}.`,
    )
  }
  const corruptedCustomRecordsCriteria = customRecords.filter(isInvalidCriteriaParam)
  if (corruptedCustomRecordsCriteria.length !== 0) {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX} Expected custom record "criteria" to be a non-empty object, but found:\n${JSON.stringify(corruptedCustomRecordsCriteria, null, 4)}}.`,
    )
  }

  const receivedTypes = types.map(obj => obj.name)
  const receivedCustomRecords = customRecords.map(obj => obj.name)
  const idsRegexes = types
    .concat(customRecords)
    .map(obj => obj.ids)
    .flatMap(list => list ?? [ALL_TYPES_REGEX])

  const invalidRegexes = idsRegexes
    .concat(fileCabinet)
    .concat(receivedTypes)
    .concat(receivedCustomRecords)
    .filter(reg => !regex.isValidRegex(reg))

  if (invalidRegexes.length !== 0) {
    throw new Error(`${ERROR_MESSAGE_PREFIX} The following regular expressions are invalid:\n${invalidRegexes}.`)
  }

  const invalidTypes = receivedTypes.filter(noSupportedTypeMatch)

  if (invalidTypes.length !== 0) {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX} The following types or regular expressions do not match any supported type:\n${invalidTypes}.`,
    )
  }
}

const validateFieldsToOmitConfig = (fieldsToOmitConfig: unknown): void => {
  if (!Array.isArray(fieldsToOmitConfig)) {
    throw new Error(`${ERROR_MESSAGE_PREFIX} "${FETCH_PARAMS.fieldsToOmit}" field is expected to be an array`)
  }
  const corruptedTypes = fieldsToOmitConfig.filter(obj => typeof obj.type !== 'string')
  if (corruptedTypes.length !== 0) {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX} Expected "type" field to be a string, but found:\n${JSON.stringify(corruptedTypes, null, 4)}.`,
    )
  }
  const corruptedSubtypes = fieldsToOmitConfig.filter(
    obj => obj.subtype !== undefined && typeof obj.subtype !== 'string',
  )
  if (corruptedSubtypes.length !== 0) {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX} Expected "subtype" field to be a string, but found:\n${JSON.stringify(corruptedSubtypes, null, 4)}.`,
    )
  }
  const corruptedFields = fieldsToOmitConfig.filter(
    obj =>
      !Array.isArray(obj.fields) ||
      obj.fields.length === 0 ||
      obj.fields.some((item: unknown) => typeof item !== 'string'),
  )
  if (corruptedFields.length !== 0) {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX} Expected "fields" field to be an array of strings, but found:\n${JSON.stringify(corruptedFields, null, 4)}.`,
    )
  }
  const invalidRegexes = fieldsToOmitConfig
    .flatMap(obj => [obj.type, ...(obj.subtype ? [obj.subtype] : []), ...obj.fields])
    .filter(reg => !regex.isValidRegex(reg))
  if (invalidRegexes.length !== 0) {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX} The following regular expressions are invalid:\n${JSON.stringify(invalidRegexes, null, 4)}.`,
    )
  }
}

function validateNetsuiteQueryParameters(
  values: Record<string, unknown>,
  configName: string,
): asserts values is NetsuiteQueryParameters {
  const { types, filePaths, customRecords } = _.pick(values, Object.values(QUERY_PARAMS))
  if (filePaths !== undefined) {
    validateArrayOfStrings(filePaths, [configName, QUERY_PARAMS.filePaths])
  }
  if (types !== undefined) {
    validatePlainObject(types, [configName, QUERY_PARAMS.types])
    Object.entries(types).forEach(([key, value]) => {
      validateArrayOfStrings(value, [configName, QUERY_PARAMS.types, key])
    })
  }
  if (customRecords !== undefined) {
    validatePlainObject(customRecords, [configName, QUERY_PARAMS.customRecords])
    Object.entries(customRecords).forEach(([key, value]) => {
      validateArrayOfStrings(value, [configName, QUERY_PARAMS.customRecords, key])
    })
  }
}

const validateInstalledSuiteApps = (installedSuiteApps: unknown): void => {
  validateArrayOfStrings(installedSuiteApps, [CONFIG.client, CLIENT_CONFIG.installedSuiteApps])
  const invalidValues = installedSuiteApps.filter(id => !SUITEAPP_ID_FORMAT_REGEX.test(id))
  if (invalidValues.length !== 0) {
    throw new Error(
      `${CLIENT_CONFIG.installedSuiteApps} values should contain only lowercase characters or numbers and exactly two dots (such as com.saltoio.salto). The following values are invalid: ${invalidValues.join(', ')}`,
    )
  }
}

function validateMaxInstancesPerType(
  maxInstancesPerType: unknown,
  { validateInvalidTypes }: { validateInvalidTypes: boolean },
): asserts maxInstancesPerType is MaxInstancesPerType[] {
  if (
    !Array.isArray(maxInstancesPerType) ||
    !maxInstancesPerType.every(
      val => 'name' in val && 'limit' in val && typeof val.name === 'string' && typeof val.limit === 'number',
    )
  ) {
    throw new Error(
      `Expected ${CLIENT_CONFIG.maxInstancesPerType} to be a list of { name: string, limit: number },` +
        ` but found:\n${safeJsonStringify(maxInstancesPerType, undefined, 4)}.`,
    )
  }
  if (!validateInvalidTypes) {
    return
  }
  const invalidTypes = maxInstancesPerType.filter(
    maxType =>
      !regex.isValidRegex(maxType.name) ||
      (noSupportedTypeMatch(maxType.name) && !isCustomRecordTypeName(maxType.name)),
  )
  if (invalidTypes.length > 0) {
    throw new Error(
      `The following types or regular expressions in ${CLIENT_CONFIG.maxInstancesPerType}` +
        ` do not match any supported type: ${safeJsonStringify(invalidTypes)}`,
    )
  }
}

function validateClientConfig(
  client: Record<string, unknown>,
  fetchTargetDefined: boolean,
): asserts client is ClientConfig {
  validatePlainObject(client, CONFIG.client)
  const { fetchAllTypesAtOnce, installedSuiteApps, maxInstancesPerType } = _.pick(client, Object.values(CLIENT_CONFIG))

  if (fetchAllTypesAtOnce && fetchTargetDefined) {
    log.warn(
      `${CLIENT_CONFIG.fetchAllTypesAtOnce} is not supported with ${CONFIG.fetchTarget}. Ignoring ${CLIENT_CONFIG.fetchAllTypesAtOnce}`,
    )
    client[CLIENT_CONFIG.fetchAllTypesAtOnce] = false
  }
  if (installedSuiteApps !== undefined) {
    validateInstalledSuiteApps(installedSuiteApps)
  }
  if (maxInstancesPerType !== undefined) {
    validateMaxInstancesPerType(maxInstancesPerType, { validateInvalidTypes: true })
  }
}

function validateAdditionalSdfDeployDependencies(
  input: Partial<Record<keyof AdditionalSdfDeployDependencies, unknown>>,
  configName: string,
): asserts input is Partial<AdditionalSdfDeployDependencies> {
  const { features, objects, files } = input
  if (features !== undefined) {
    validateArrayOfStrings(features, [CONFIG.deploy, DEPLOY_PARAMS.additionalDependencies, configName, 'features'])
  }
  if (objects !== undefined) {
    validateArrayOfStrings(objects, [CONFIG.deploy, DEPLOY_PARAMS.additionalDependencies, configName, 'objects'])
  }
  if (files !== undefined) {
    validateArrayOfStrings(files, [CONFIG.deploy, DEPLOY_PARAMS.additionalDependencies, configName, 'files'])
  }
}

const validateAdditionalDependencies = ({
  include,
  exclude,
}: Partial<Record<keyof AdditionalDependencies, unknown>>): void => {
  if (include !== undefined) {
    validatePlainObject(include, [CONFIG.deploy, DEPLOY_PARAMS.additionalDependencies, 'include'])
    validateAdditionalSdfDeployDependencies(include, 'include')
  }
  if (exclude !== undefined) {
    validatePlainObject(exclude, [CONFIG.deploy, DEPLOY_PARAMS.additionalDependencies, 'exclude'])
    validateAdditionalSdfDeployDependencies(exclude, 'exclude')
  }
  if (include?.features && exclude?.features) {
    const conflictedFeatures = _.intersection(
      include.features.map(featureName =>
        isRequiredFeature(featureName) ? removeRequiredFeatureSuffix(featureName) : featureName,
      ),
      exclude.features,
    )
    if (conflictedFeatures.length > 0) {
      throw new Error(
        `Additional features cannot be both included and excluded. The following features are conflicted: ${conflictedFeatures.join(', ')}`,
      )
    }
  }
  if (include?.objects && exclude?.objects) {
    const conflictedObjects = _.intersection(include.objects, exclude.objects)
    if (conflictedObjects.length > 0) {
      throw new Error(
        `Additional objects cannot be both included and excluded. The following objects are conflicted: ${conflictedObjects.join(', ')}`,
      )
    }
  }
  if (include?.files && exclude?.files) {
    const conflictedFiles = _.intersection(include.files, exclude.files)
    if (conflictedFiles.length > 0) {
      throw new Error(
        `Additional files cannot be both included and excluded. The following files are conflicted: ${conflictedFiles.join(', ')}`,
      )
    }
  }
}

const validateFetchConfig = ({
  include,
  exclude,
  fieldsToOmit,
  skipResolvingAccountSpecificValuesToTypes,
}: Record<keyof FetchParams, unknown>): void => {
  validateDefined(include, [CONFIG.fetch, FETCH_PARAMS.include])
  validatePlainObject(include, [CONFIG.fetch, FETCH_PARAMS.include])
  validateFetchParameters(include)
  if (include.types.concat(include.customRecords ?? []).filter(isCriteriaQuery).length > 0) {
    throw new Error(
      'The "criteria" configuration option is exclusively permitted within the "fetch.exclude" configuration and should not be used within the "fetch.include" configuration.',
    )
  }

  validateDefined(exclude, [CONFIG.fetch, FETCH_PARAMS.exclude])
  validatePlainObject(exclude, [CONFIG.fetch, FETCH_PARAMS.exclude])
  validateFetchParameters(exclude)

  if (fieldsToOmit !== undefined) {
    validateFieldsToOmitConfig(fieldsToOmit)
  }

  if (skipResolvingAccountSpecificValuesToTypes !== undefined) {
    validateArrayOfStrings(skipResolvingAccountSpecificValuesToTypes, [
      CONFIG.fetch,
      FETCH_PARAMS.skipResolvingAccountSpecificValuesToTypes,
    ])
    validateRegularExpressions(skipResolvingAccountSpecificValuesToTypes, [
      CONFIG.fetch,
      FETCH_PARAMS.skipResolvingAccountSpecificValuesToTypes,
    ])
  }
}

const validateDeployParams = ({
  deployReferencedElements,
  warnOnStaleWorkspaceData,
  validate,
  additionalDependencies,
  fieldsToOmit,
}: Record<keyof DeployParams, unknown>): void => {
  if (deployReferencedElements !== undefined) {
    validateBoolean(deployReferencedElements, [CONFIG.deploy, DEPLOY_PARAMS.deployReferencedElements])
  }
  if (warnOnStaleWorkspaceData !== undefined) {
    validateBoolean(warnOnStaleWorkspaceData, [CONFIG.deploy, DEPLOY_PARAMS.warnOnStaleWorkspaceData])
  }
  if (validate !== undefined) {
    validateBoolean(validate, [CONFIG.deploy, DEPLOY_PARAMS.validate])
  }
  if (additionalDependencies !== undefined) {
    validatePlainObject(additionalDependencies, [CONFIG.deploy, DEPLOY_PARAMS.additionalDependencies])
    validateAdditionalDependencies(additionalDependencies)
  }
  if (fieldsToOmit !== undefined) {
    validateFieldsToOmitConfig(fieldsToOmit)
  }
}

const validateSuiteAppClientParams = ({
  suiteAppConcurrencyLimit,
  httpTimeoutLimitInMinutes,
  maxRecordsPerSuiteQLTable,
}: Record<keyof SuiteAppClientConfig, unknown>): void => {
  if (suiteAppConcurrencyLimit !== undefined) {
    validateNumber(suiteAppConcurrencyLimit, [CONFIG.suiteAppClient, SUITEAPP_CLIENT_CONFIG.suiteAppConcurrencyLimit])
  }
  if (httpTimeoutLimitInMinutes !== undefined) {
    validateNumber(httpTimeoutLimitInMinutes, [CONFIG.suiteAppClient, SUITEAPP_CLIENT_CONFIG.httpTimeoutLimitInMinutes])
  }
  if (maxRecordsPerSuiteQLTable !== undefined) {
    validateMaxInstancesPerType(maxRecordsPerSuiteQLTable, { validateInvalidTypes: false })
  }
}

export function validateConfig(input: Record<string, unknown>): asserts input is NetsuiteConfig {
  try {
    const config = _.pick(input, Object.values(CONFIG))
    validateDefined(config.fetch, CONFIG.fetch)
    validatePlainObject(config.fetch, CONFIG.fetch)
    validateFetchConfig(config.fetch)
    if (config.includeAllSavedSearches !== undefined) {
      validateBoolean(config.includeAllSavedSearches, CONFIG.includeAllSavedSearches)
    }
    if (config.includeCustomRecords !== undefined) {
      validateArrayOfStrings(config.includeCustomRecords, CONFIG.includeCustomRecords)
    }
    if (config.includeInactiveRecords !== undefined) {
      validateArrayOfStrings(config.includeInactiveRecords, CONFIG.includeInactiveRecords)
    }
    if (config.includeDataFileTypes !== undefined) {
      validateArrayOfStrings(config.includeDataFileTypes, CONFIG.includeDataFileTypes)
    }
    if (config.includeFileCabinetFolders !== undefined) {
      validateArrayOfStrings(config.includeFileCabinetFolders, CONFIG.includeFileCabinetFolders)
    }
    if (config.filePathRegexSkipList !== undefined) {
      validateArrayOfStrings(config.filePathRegexSkipList, CONFIG.filePathRegexSkipList)
      validateRegularExpressions(config.filePathRegexSkipList, CONFIG.filePathRegexSkipList)
    }
    if (config.typesToSkip !== undefined) {
      validateArrayOfStrings(config.typesToSkip, CONFIG.typesToSkip)
    }
    if (config.client !== undefined) {
      validatePlainObject(config.client, CONFIG.client)
      validateClientConfig(config.client, config.fetchTarget !== undefined)
    }
    if (config.fetchTarget !== undefined) {
      validatePlainObject(config.fetchTarget, CONFIG.fetchTarget)
      validateNetsuiteQueryParameters(config.fetchTarget, CONFIG.fetchTarget)
      validateFetchParameters(convertToQueryParams(config.fetchTarget))
    }
    if (config.skipList !== undefined) {
      validatePlainObject(config.skipList, CONFIG.skipList)
      validateNetsuiteQueryParameters(config.skipList, CONFIG.skipList)
      validateFetchParameters(convertToQueryParams(config.skipList))
    }
    if (config.deploy !== undefined) {
      validatePlainObject(config.deploy, CONFIG.deploy)
      validateDeployParams(config.deploy)
    }
    if (config.suiteAppClient !== undefined) {
      validatePlainObject(config.suiteAppClient, CONFIG.suiteAppClient)
      validateSuiteAppClientParams(config.suiteAppClient)
    }
  } catch (e) {
    if (e instanceof Error) {
      e.message =
        `Failed to load Netsuite config: ${e.message}${e.message.endsWith('.') ? '' : '.'}\n` +
        'More information about Netsuite configuration options in Salto can be found here: https://github.com/salto-io/salto/blob/main/packages/netsuite-adapter/config_doc.md'
    }
    log.error('netsuite config from config failed with error: %o', e)
    throw e
  }
}
