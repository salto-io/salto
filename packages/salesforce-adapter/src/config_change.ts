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
import { ListMetadataQuery, RetrieveResult } from '@salto-io/jsforce-types'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import { Values, InstanceElement, ElemID } from '@salto-io/adapter-api'
import { formatConfigSuggestionsReasons } from '@salto-io/adapter-utils'
import {
  ConfigChangeSuggestion,
  configType,
  isDataManagementConfigSuggestions,
  isMetadataConfigSuggestions,
  SalesforceConfig,
  DataManagementConfig,
  isRetrieveSizeConfigSuggestion,
  MetadataConfigSuggestion,
  MetadataQueryParams,
} from './types'
import * as constants from './constants'
import {
  SALESFORCE_ERRORS,
  SalesforceErrorName,
  SOCKET_TIMEOUT,
} from './constants'

const { isDefined } = values
const { makeArray } = collections.array

const log = logger(module)

const {
  DUPLICATE_VALUE,
  INVALID_CROSS_REFERENCE_KEY,
  INVALID_FIELD,
  INVALID_ID_FIELD,
  INVALID_TYPE,
  UNKNOWN_EXCEPTION,
  INVALID_QUERY_FILTER_OPERATOR,
} = SALESFORCE_ERRORS

const CONFIG_SUGGESTIONS_GENERAL_MESSAGE =
  'Salto failed to fetch some items from Salesforce.' +
  ' Failed items must be excluded from the fetch.'

const getConfigChangeMessage = (
  configChanges: ConfigChangeSuggestion[],
): string => {
  const reasons = configChanges
    .map((configChange) => configChange.reason)
    .filter(isDefined)
  return formatConfigSuggestionsReasons([
    CONFIG_SUGGESTIONS_GENERAL_MESSAGE,
    ...reasons,
  ])
}

export const createManyInstancesExcludeConfigChange = ({
  typeName,
  instancesCount,
  maxInstancesPerType,
}: {
  typeName: string
  instancesCount: number
  maxInstancesPerType: number
}): ConfigChangeSuggestion => {
  // Return a config suggestion to exclude that type from the dataObjects
  const reason = `Your application configuration has been updated to exclude instances of ${typeName} due to their count of ${instancesCount} exceeding the allowed maximum ${maxInstancesPerType}. To include these instances, remove ${typeName} from the application's fetch exclude block and increase the maxInstancesPerType limit. Learn more here: https://help.salto.io/en/articles/8843243-limiting-the-number-of-data-records-fetched-by-salto`
  return {
    type: 'dataObjectsExclude',
    value: typeName,
    reason,
  }
}

export const createInvalidIdFieldConfigChange = (
  typeName: string,
  invalidFields: string[],
): ConfigChangeSuggestion => ({
  type: 'dataObjectsExclude',
  value: typeName,
  reason: `${invalidFields} defined as idFields but are not queryable or do not exist on type ${typeName}`,
})

export const createUnresolvedRefIdFieldConfigChange = (
  typeName: string,
  unresolvedRefIdFields: string[],
): ConfigChangeSuggestion => ({
  type: 'dataObjectsExclude',
  value: typeName,
  reason: `${typeName} has ${unresolvedRefIdFields} (reference) configured as idField. Failed to resolve some of the references.`,
})

export const createSkippedListConfigChange = ({
  type,
  instance,
  reason,
}: {
  type: string
  instance?: string
  reason?: string
}): ConfigChangeSuggestion => {
  if (_.isUndefined(instance)) {
    return {
      type: 'metadataExclude',
      value: { metadataType: type },
      reason,
    }
  }
  return {
    type: 'metadataExclude',
    value: { metadataType: type, name: instance },
    reason,
  }
}

type ConfigSuggestionsCreatorInput = Required<
  Pick<MetadataQueryParams, 'metadataType' | 'name'>
>

type CreateConfigSuggestionFunc = (
  input: ConfigSuggestionsCreatorInput,
) => MetadataConfigSuggestion
type CreateConfigSuggestionPredicate = (error: Error) => boolean

const isSocketTimeoutError: CreateConfigSuggestionPredicate = (
  e: Error,
): boolean => e.message === SOCKET_TIMEOUT
const isInvalidCrossReferenceKeyError: CreateConfigSuggestionPredicate = (
  e: Error,
): boolean => {
  const errorCode = _.get(e, 'errorCode')
  return _.isString(errorCode) && errorCode === INVALID_CROSS_REFERENCE_KEY
}

export const NON_TRANSIENT_SALESFORCE_ERRORS: SalesforceErrorName[] = [
  DUPLICATE_VALUE,
  INVALID_ID_FIELD,
  INVALID_FIELD,
  INVALID_TYPE,
  UNKNOWN_EXCEPTION,
  INVALID_QUERY_FILTER_OPERATOR,
]

const isNonTransientSalesforceError: CreateConfigSuggestionPredicate = (
  e: Error,
): boolean =>
  (NON_TRANSIENT_SALESFORCE_ERRORS as ReadonlyArray<string>).includes(e.name)

type ConfigSuggestionCreator = {
  predicate: CreateConfigSuggestionPredicate
  create: CreateConfigSuggestionFunc
}

export const createSocketTimeoutConfigSuggestion: CreateConfigSuggestionFunc = (
  input: ConfigSuggestionsCreatorInput,
): MetadataConfigSuggestion => ({
  type: 'metadataExclude',
  value: input,
  reason: `${input.metadataType} with name ${input.name} exceeded fetch timeout`,
})

export const createInvalidCrossReferenceKeyConfigSuggestion: CreateConfigSuggestionFunc =
  (input: ConfigSuggestionsCreatorInput): MetadataConfigSuggestion => ({
    type: 'metadataExclude',
    value: input,
    reason: `${input.metadataType} with name ${input.name} failed due to INVALID_CROSS_REFERENCE_KEY`,
  })

export const createNonTransientSalesforceErrorConfigSuggestion: CreateConfigSuggestionFunc =
  (input: ConfigSuggestionsCreatorInput): MetadataConfigSuggestion => ({
    type: 'metadataExclude',
    value: input,
    reason: `${input.metadataType} with name ${input.name} failed with non transient error`,
  })

const NON_TRANSIENT_SALESFORCE_ERROR = 'NON_TRANSIENT_SALESFORCE_ERROR'

const CONFIG_SUGGESTION_CREATOR_NAMES = [
  SOCKET_TIMEOUT,
  INVALID_CROSS_REFERENCE_KEY,
  NON_TRANSIENT_SALESFORCE_ERROR,
] as const

type ConfigSuggestionCreatorName =
  (typeof CONFIG_SUGGESTION_CREATOR_NAMES)[number]

const CONFIG_SUGGESTION_CREATORS: Record<
  ConfigSuggestionCreatorName,
  ConfigSuggestionCreator
> = {
  [SOCKET_TIMEOUT]: {
    predicate: isSocketTimeoutError,
    create: createSocketTimeoutConfigSuggestion,
  },
  [INVALID_CROSS_REFERENCE_KEY]: {
    predicate: isInvalidCrossReferenceKeyError,
    create: createInvalidCrossReferenceKeyConfigSuggestion,
  },
  [NON_TRANSIENT_SALESFORCE_ERROR]: {
    predicate: isNonTransientSalesforceError,
    create: createNonTransientSalesforceErrorConfigSuggestion,
  },
}

export const HANDLED_ERROR_PREDICATES = Object.values(
  CONFIG_SUGGESTION_CREATORS,
).map((creator) => creator.predicate)

export const createSkippedListConfigChangeFromError = ({
  creatorInput,
  error,
}: {
  creatorInput: ConfigSuggestionsCreatorInput
  error: Error
}): ConfigChangeSuggestion =>
  Object.values(CONFIG_SUGGESTION_CREATORS)
    .find((creator) => creator.predicate(error))
    ?.create(creatorInput) ??
  createSkippedListConfigChange({
    type: creatorInput.metadataType,
    instance: creatorInput.name,
  })

export const createListMetadataObjectsConfigChange = (
  res: ListMetadataQuery,
): ConfigChangeSuggestion =>
  createSkippedListConfigChange({ type: res.type, instance: res.folder })

export const createRetrieveConfigChange = (
  result: RetrieveResult,
): ConfigChangeSuggestion[] => {
  const configChanges = makeArray(result.messages)
    .map((msg: Values) =>
      constants.RETRIEVE_LOAD_OF_METADATA_ERROR_REGEX.exec(msg.problem ?? ''),
    )
    .filter((regexRes) => !_.isUndefined(regexRes?.groups))
    .map((regexRes) =>
      createSkippedListConfigChange({
        type: regexRes?.groups?.type as string,
        instance: regexRes?.groups?.instance as string,
        reason: regexRes?.[0],
      }),
    )
  log.debug('Created the config changes %o', configChanges)
  return configChanges
}

export type ConfigChange = {
  config: InstanceElement[]
  message: string
}

export const getConfigFromConfigChanges = (
  configChanges: ConfigChangeSuggestion[],
  currentConfig: Readonly<SalesforceConfig>,
): ConfigChange | undefined => {
  const currentMetadataExclude = makeArray(
    currentConfig.fetch?.metadata?.exclude,
  )

  const newMetadataExclude = makeArray(configChanges)
    .filter(isMetadataConfigSuggestions)
    .map((e) => e.value)
    .filter((e) => !currentMetadataExclude.includes(e))

  const dataObjectsToExclude = makeArray(configChanges)
    .filter(isDataManagementConfigSuggestions)
    .map((config) => config.value)

  const retrieveSize = configChanges
    .filter(isRetrieveSizeConfigSuggestion)
    .map((config) => config.value)
    .map((value) =>
      Math.max(value, constants.MINIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST),
    )
    .sort((a, b) => a - b)[0]

  if (
    [newMetadataExclude, dataObjectsToExclude].every(_.isEmpty) &&
    retrieveSize === undefined
  ) {
    return undefined
  }

  const currentDataManagement = currentConfig.fetch?.data

  const dataManagementOverrides = {
    excludeObjects: makeArray(currentDataManagement?.excludeObjects).concat(
      dataObjectsToExclude,
    ),
  }
  if (Array.isArray(currentDataManagement?.allowReferenceTo)) {
    Object.assign(dataManagementOverrides, {
      allowReferenceTo: currentDataManagement?.allowReferenceTo.filter(
        (objectName) => !dataObjectsToExclude.includes(objectName),
      ),
    })
  }

  const data =
    currentDataManagement === undefined
      ? undefined
      : (_.pickBy(
          {
            ...currentDataManagement,
            ...dataManagementOverrides,
          },
          isDefined,
        ) as DataManagementConfig | undefined)

  const maxItemsInRetrieveRequest =
    retrieveSize ?? currentConfig.maxItemsInRetrieveRequest

  return {
    config: [
      new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        _.pickBy(
          {
            fetch: _.pickBy(
              {
                ...(currentConfig.fetch ?? {}),
                metadata: {
                  ...currentConfig.fetch?.metadata,
                  exclude: [...currentMetadataExclude, ...newMetadataExclude],
                },
                data:
                  data === undefined
                    ? undefined
                    : {
                        ...data,
                        saltoIDSettings: _.pickBy(
                          data.saltoIDSettings,
                          isDefined,
                        ),
                      },
              },
              isDefined,
            ),
            maxItemsInRetrieveRequest,
            client: currentConfig.client,
          },
          isDefined,
        ),
      ),
    ],
    message: getConfigChangeMessage(configChanges),
  }
}
