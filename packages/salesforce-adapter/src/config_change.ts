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
import _ from 'lodash'
import { ListMetadataQuery, RetrieveResult } from 'jsforce-types'
import { collections, values } from '@salto-io/lowerdash'
import { Values, InstanceElement, ElemID } from '@salto-io/adapter-api'
import { ConfigChangeSuggestion, configType, isDataManagementConfigSuggestions, isMetadataConfigSuggestions, SalesforceConfig, DataManagementConfig, isRetrieveSizeConfigSuggstion } from './types'
import * as constants from './constants'

const { isDefined } = values
const { makeArray } = collections.array

const MESSAGE_INTRO = 'Salto failed to fetch some items from salesforce. '
const MESSAGE_REASONS_INTRO = 'Due to the following issues: '
const MESSAGE_SUMMARY = 'In order to complete the fetch operation, '
+ 'Salto needs to stop managing these items by applying the following configuration change:'


const formatReason = (reason: string): string =>
  `    * ${reason}`

export const getConfigChangeMessage = (configChanges: ConfigChangeSuggestion[]): string => {
  const reasons = configChanges.map(configChange => configChange.reason).filter(isDefined)
  if (_.isEmpty(reasons)) {
    return [MESSAGE_INTRO, '', MESSAGE_SUMMARY].join('\n')
  }

  return [MESSAGE_INTRO, '', MESSAGE_REASONS_INTRO, ...reasons.map(formatReason), '', MESSAGE_SUMMARY].join('\n')
}

export const createInvlidIdFieldConfigChange = (
  typeName: string,
  invalidFields: string[]
): ConfigChangeSuggestion =>
  ({
    type: 'dataObjectsExclude',
    value: typeName,
    reason: `${invalidFields} defined as idFields but are not queryable or do not exist on type ${typeName}`,
  })

export const createUnresolvedRefIdFieldConfigChange = (
  typeName: string,
  unresolvedRefIdFields: string[]
): ConfigChangeSuggestion =>
  ({
    type: 'dataObjectsExclude',
    value: typeName,
    reason: `${typeName} has ${unresolvedRefIdFields} (reference) configured as idField. Failed to resolve some of the references.`,
  })

export const createSkippedListConfigChange = ({ type, instance, reason }
  : { type: string; instance?: string; reason?: string }):
  ConfigChangeSuggestion => {
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

export const createListMetadataObjectsConfigChange = (res: ListMetadataQuery):
  ConfigChangeSuggestion => createSkippedListConfigChange({ type: res.type, instance: res.folder })

export const createRetrieveConfigChange = (result: RetrieveResult): ConfigChangeSuggestion[] =>
  makeArray(result.messages)
    .map((msg: Values) => constants.RETRIEVE_LOAD_OF_METADATA_ERROR_REGEX.exec(msg.problem ?? ''))
    .filter(regexRes => !_.isUndefined(regexRes?.groups))
    .map(regexRes => createSkippedListConfigChange({
      type: regexRes?.groups?.type as string,
      instance: regexRes?.groups?.instance as string,
    }))

export type ConfigChange = {
  config: InstanceElement[]
  message: string
}

export const getConfigFromConfigChanges = (
  configChanges: ConfigChangeSuggestion[],
  currentConfig: Readonly<SalesforceConfig>,
): ConfigChange | undefined => {
  const currentMetadataExclude = makeArray(currentConfig.fetch?.metadata?.exclude)

  const newMetadataExclude = makeArray(configChanges)
    .filter(isMetadataConfigSuggestions)
    .map(e => e.value)
    .filter(e => !currentMetadataExclude.includes(e))

  const dataObjectsToExclude = makeArray(configChanges)
    .filter(isDataManagementConfigSuggestions)
    .map(config => config.value)

  const retrieveSize = configChanges
    .filter(isRetrieveSizeConfigSuggstion)
    .map(config => config.value)
    .map(value => Math.max(value, constants.MINIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST))
    .sort((a, b) => a - b)[0]

  if ([newMetadataExclude, dataObjectsToExclude].every(_.isEmpty) && retrieveSize === undefined) {
    return undefined
  }

  const currentDataManagement = currentConfig.fetch?.data

  const dataManagementOverrides = {
    excludeObjects: makeArray(currentDataManagement?.excludeObjects)
      .concat(dataObjectsToExclude),
  }
  if (Array.isArray(currentDataManagement?.allowReferenceTo)) {
    Object.assign(
      dataManagementOverrides,
      {
        allowReferenceTo: currentDataManagement?.allowReferenceTo
          .filter(objectName => !dataObjectsToExclude.includes(objectName)),
      }
    )
  }

  const data = currentDataManagement === undefined ? undefined : _.pickBy({
    ...currentDataManagement,
    ...dataManagementOverrides,
  }, isDefined) as DataManagementConfig | undefined

  const maxItemsInRetrieveRequest = retrieveSize ?? currentConfig.maxItemsInRetrieveRequest

  return {
    config: [new InstanceElement(
      ElemID.CONFIG_NAME,
      configType,
      _.pickBy({
        fetch: _.pickBy({
          ...(currentConfig.fetch ?? {}),
          metadata: {
            ...currentConfig.fetch?.metadata,
            exclude: [
              ...currentMetadataExclude,
              ...newMetadataExclude,
            ],
          },
          data: data === undefined ? undefined : {
            ...data,
            saltoIDSettings: _.pickBy(data.saltoIDSettings, isDefined),
          },
        }, isDefined),
        maxItemsInRetrieveRequest,
        client: currentConfig.client,
      }, isDefined)
    )],
    message: getConfigChangeMessage(configChanges),
  }
}
