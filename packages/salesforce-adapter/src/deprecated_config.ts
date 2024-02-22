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

import { InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  ConfigValidationError,
  validateRegularExpressions,
} from './config_validation'
import { validateDataManagementConfig } from './fetch_profile/data_management'
import {
  DataManagementConfig,
  DATA_CONFIGURATION,
  DATA_MANAGEMENT,
  DeprecatedFetchParameters,
  DeprecatedMetadataParams,
  FetchParameters,
  FETCH_CONFIG,
  INSTANCES_REGEX_SKIPPED_LIST,
  INSTANCE_SUFFIXES,
  MetadataParams,
  METADATA_CONFIG,
  METADATA_TYPES_SKIPPED_LIST,
} from './types'

export const DEPRECATED_OPTIONS_MESSAGE =
  'The configuration options "metadataTypesSkippedList", "instancesRegexSkippedList" and "dataManagement" are deprecated.' +
  ' The following changes will update the deprecated options to the "fetch" configuration option.'

const { makeArray } = collections.array
const log = logger(module)

export const PACKAGES_INSTANCES_REGEX = `^.+\\.(?!standard_)[^_]+__(?!(${INSTANCE_SUFFIXES.join('|')})([^a-zA-Z\\d_]+|$)).+$`

const DEPRECATED_FIELDS = [
  INSTANCES_REGEX_SKIPPED_LIST,
  METADATA_TYPES_SKIPPED_LIST,
  DATA_MANAGEMENT,
]

const validateDeprecatedParameters = (
  config: Readonly<InstanceElement>,
): void => {
  if (config.value[METADATA_TYPES_SKIPPED_LIST] !== undefined) {
    log.warn(
      `${METADATA_TYPES_SKIPPED_LIST} configuration option is deprecated. ${FETCH_CONFIG}.${METADATA_CONFIG} should be used instead`,
    )
  }
  if (config.value[INSTANCES_REGEX_SKIPPED_LIST] !== undefined) {
    log.warn(
      `${INSTANCES_REGEX_SKIPPED_LIST} configuration option is deprecated. ${FETCH_CONFIG}.${METADATA_CONFIG} should be used instead`,
    )
    validateRegularExpressions(config?.value?.[INSTANCES_REGEX_SKIPPED_LIST], [
      INSTANCES_REGEX_SKIPPED_LIST,
    ])
  }
  if (config.value[DATA_MANAGEMENT] !== undefined) {
    if (config.value[FETCH_CONFIG]?.[DATA_CONFIGURATION] !== undefined) {
      throw new ConfigValidationError(
        [DATA_MANAGEMENT],
        `${FETCH_CONFIG}.${DATA_CONFIGURATION} configuration option cannot be used with ${DATA_MANAGEMENT} option. The configuration of ${DATA_MANAGEMENT} should be moved to ${FETCH_CONFIG}.${DATA_CONFIGURATION}`,
      )
    }

    log.warn(
      `${DATA_MANAGEMENT} configuration option is deprecated. ${FETCH_CONFIG}.${DATA_CONFIGURATION} should be used instead`,
    )

    validateDataManagementConfig(config.value[DATA_MANAGEMENT], [
      DATA_MANAGEMENT,
    ])
  }
}

const convertDeprecatedRegex = (filePathRegex: string): string => {
  let newPathRegex = filePathRegex

  newPathRegex = filePathRegex.startsWith('^')
    ? newPathRegex.substring(1)
    : newPathRegex

  newPathRegex =
    !filePathRegex.startsWith('.*') && !filePathRegex.startsWith('^')
      ? `.*${newPathRegex}`
      : newPathRegex

  newPathRegex = filePathRegex.endsWith('$')
    ? newPathRegex.substring(0, newPathRegex.length - 1)
    : newPathRegex

  newPathRegex =
    !filePathRegex.endsWith('$') &&
    (!filePathRegex.endsWith('.*') || filePathRegex.endsWith('\\.*'))
      ? `${newPathRegex}.*`
      : newPathRegex

  return newPathRegex
}

const convertDeprecatedMetadataParams = (
  currentParams: MetadataParams,
  deprecatedParams: DeprecatedMetadataParams,
): MetadataParams => {
  const excludes = [
    ...makeArray(deprecatedParams.instancesRegexSkippedList)
      .filter((re) => re !== PACKAGES_INSTANCES_REGEX)
      .map((re) => {
        const regexParts = re.split('.')
        if (regexParts.length < 2) {
          return { name: convertDeprecatedRegex(re) }
        }
        return {
          metadataType: convertDeprecatedRegex(`${regexParts[0]}$`),
          name: convertDeprecatedRegex(`^${regexParts.slice(1).join('.')}`),
        }
      }),
    ...makeArray(deprecatedParams.metadataTypesSkippedList).map((type) => ({
      metadataType: type,
    })),
  ]

  const includes = makeArray(
    deprecatedParams.instancesRegexSkippedList,
  ).includes(PACKAGES_INSTANCES_REGEX)
    ? [{ namespace: '', name: '.*', metadataType: '.*' }]
    : []

  return _.pickBy(
    {
      include: [...(currentParams.include ?? []), ...includes],
      exclude: [...(currentParams.exclude ?? []), ...excludes],
    },
    (value) => value.length !== 0,
  )
}

const convertDeprecatedDataConf = (
  conf: DataManagementConfig,
): DataManagementConfig => ({
  ..._.pickBy(
    {
      ...conf,
      excludeObjects: conf?.excludeObjects?.map(convertDeprecatedRegex),
      allowReferenceTo: conf?.allowReferenceTo?.map(convertDeprecatedRegex),
    },
    values.isDefined,
  ),
  includeObjects: conf.includeObjects.map(convertDeprecatedRegex),
  saltoIDSettings: {
    ..._.pickBy(
      {
        ...conf.saltoIDSettings,
        overrides: conf.saltoIDSettings.overrides?.map((override) => ({
          ...override,
          objectsRegex: convertDeprecatedRegex(override.objectsRegex),
        })),
      },
      values.isDefined,
    ),
    defaultIdFields: conf.saltoIDSettings.defaultIdFields,
  },
})

const convertDeprecatedFetchParameters = (
  fetchParameters: FetchParameters | undefined,
  deprecatedFetchParameters: DeprecatedFetchParameters,
): FetchParameters | undefined => {
  const metadata =
    deprecatedFetchParameters?.instancesRegexSkippedList !== undefined ||
    deprecatedFetchParameters?.metadataTypesSkippedList !== undefined
      ? convertDeprecatedMetadataParams(
          fetchParameters?.metadata ?? {},
          deprecatedFetchParameters,
        )
      : fetchParameters?.metadata

  const data =
    deprecatedFetchParameters.dataManagement !== undefined
      ? convertDeprecatedDataConf(deprecatedFetchParameters.dataManagement)
      : fetchParameters?.data

  const updatedFetchParameters = _.pickBy(
    {
      ...(fetchParameters ?? {}),
      metadata,
      data,
    },
    values.isDefined,
  )
  return _.isEmpty(updatedFetchParameters) ? undefined : updatedFetchParameters
}

export const updateDeprecatedConfiguration = (
  configuration: Readonly<InstanceElement> | undefined,
):
  | {
      config: InstanceElement
      message: string
    }
  | undefined => {
  if (
    configuration === undefined ||
    DEPRECATED_FIELDS.every((field) => configuration.value[field] === undefined)
  ) {
    return undefined
  }

  validateDeprecatedParameters(configuration)

  const updatedConf = configuration.clone()
  updatedConf.value = {
    ..._.omit(updatedConf.value, DEPRECATED_FIELDS),
    [FETCH_CONFIG]: convertDeprecatedFetchParameters(
      updatedConf.value[FETCH_CONFIG],
      updatedConf.value,
    ),
  }
  return { config: updatedConf, message: DEPRECATED_OPTIONS_MESSAGE }
}
