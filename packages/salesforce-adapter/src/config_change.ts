/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ConfigChangeSuggestion, INSTANCES_REGEX_SKIPPED_LIST, METADATA_TYPES_SKIPPED_LIST, DATA_MANAGEMENT, configType, SalesforceConfig } from './types'
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
    type: DATA_MANAGEMENT,
    value: typeName,
    reason: `${invalidFields} defined as idFields but are not queryable or do not exist on type ${typeName}`,
  })

export const createUnresolvedRefIdFieldConfigChange = (
  typeName: string,
  unresolvedRefIdFields: string[]
): ConfigChangeSuggestion =>
  ({
    type: DATA_MANAGEMENT,
    value: typeName,
    reason: `${typeName} has ${unresolvedRefIdFields} (reference) configured as idField. Failed to resolve some of the references.`,
  })

export const createSkippedListConfigChange = (type: string, instance?: string):
  ConfigChangeSuggestion => {
  if (_.isUndefined(instance)) {
    return {
      type: METADATA_TYPES_SKIPPED_LIST,
      value: type,
    }
  }
  return {
    type: INSTANCES_REGEX_SKIPPED_LIST,
    value: `^${type}.${instance}$`,
  }
}

export const createListMetadataObjectsConfigChange = (res: ListMetadataQuery):
  ConfigChangeSuggestion => createSkippedListConfigChange(res.type, res.folder)

export const createRetrieveConfigChange = (result: RetrieveResult): ConfigChangeSuggestion[] =>
  makeArray(result.messages)
    .map((msg: Values) => constants.RETRIEVE_LOAD_OF_METADATA_ERROR_REGEX.exec(msg.problem ?? ''))
    .filter(regexRes => !_.isUndefined(regexRes?.groups))
    .map(regexRes => createSkippedListConfigChange(
      regexRes?.groups?.type as string,
      regexRes?.groups?.instance as string
    ))

export const getConfigFromConfigChanges = (
  configChanges: ConfigChangeSuggestion[],
  currentConfig: Readonly<SalesforceConfig>,
): InstanceElement | undefined => {
  const configChangesByType = _.groupBy(configChanges, 'type')
  const currentMetadataTypesSkippedList = makeArray(currentConfig.metadataTypesSkippedList)
  const currentInstancesRegexSkippedList = makeArray(currentConfig.instancesRegexSkippedList)
  const currentDataManagement = currentConfig.dataManagement
  const metadataTypesSkippedList = makeArray(configChangesByType.metadataTypesSkippedList)
    .map(e => e.value)
    .filter(e => !currentMetadataTypesSkippedList.includes(e))
  const instancesRegexSkippedList = makeArray(configChangesByType.instancesRegexSkippedList)
    .map(e => e.value)
    .filter(e => !currentInstancesRegexSkippedList.includes(e))
  const dataObjectsToExclude = makeArray(configChangesByType.dataManagement)
    .map(config => config.value)
  if ([metadataTypesSkippedList, instancesRegexSkippedList, dataObjectsToExclude]
    .every(_.isEmpty)) {
    return undefined
  }
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
  return new InstanceElement(
    ElemID.CONFIG_NAME,
    configType,
    _.pickBy({
      metadataTypesSkippedList: metadataTypesSkippedList
        .concat(currentMetadataTypesSkippedList),
      instancesRegexSkippedList: instancesRegexSkippedList
        .concat(currentInstancesRegexSkippedList),
      maxConcurrentRetrieveRequests: currentConfig.maxConcurrentRetrieveRequests,
      maxItemsInRetrieveRequest: currentConfig.maxItemsInRetrieveRequest,
      enableHideTypesInNacls: currentConfig.enableHideTypesInNacls,
      dataManagement: currentDataManagement === undefined ? undefined : {
        ...currentDataManagement,
        ...dataManagementOverrides,
      },
    }, isDefined)
  )
}
