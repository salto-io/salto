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
import _ from 'lodash'
import { BuiltinTypes, ElemID, getChangeData, InstanceElement, isInstanceElement, ModificationChange, ObjectType } from '@salto-io/adapter-api'
import { NETSUITE, SELECT_OPTION, SETTINGS_PATH, TYPES_PATH } from './constants'
import { SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES, DeployResult } from './types'
import { NetsuiteQuery } from './query'
import { ConfigRecord, isSuccessSetConfig, SetConfigRecordsValuesResult, SetConfigType } from './client/suiteapp_client/types'

export const getConfigTypes = (): ObjectType[] => ([new ObjectType({
  elemID: new ElemID(NETSUITE, SELECT_OPTION),
  fields: {
    text: { refType: BuiltinTypes.STRING },
    value: { refType: BuiltinTypes.UNKNOWN },
  },
  path: [NETSUITE, TYPES_PATH, SELECT_OPTION],
})])

export const toConfigElements = (
  configRecords: ConfigRecord[],
  fetchQuery: NetsuiteQuery
): (
  ObjectType | InstanceElement
)[] => {
  const elements = configRecords
    .flatMap(configRecord => {
      const typeName = SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES[configRecord.configType]
      const configRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, typeName),
        annotations: { fieldsDef: configRecord.fieldsDef },
        isSettings: true,
        path: [NETSUITE, TYPES_PATH, typeName],
      })
      const instance = new InstanceElement(
        ElemID.CONFIG_NAME,
        configRecordType,
        { configRecord },
        [NETSUITE, SETTINGS_PATH, configRecordType.elemID.name],
      )
      return [configRecordType, instance]
    })

  const [instances, types] = _.partition(elements, isInstanceElement)
  const matchingInstances = instances
    .filter(instance => fetchQuery.isTypeMatch(instance.elemID.typeName))
  return [...types, ...matchingInstances]
}

export const toSetConfigTypes = (
  changes: ModificationChange<InstanceElement>[]
): SetConfigType[] =>
  changes.map(change => {
    const { before, after } = change.data
    const items = Object.entries(after.value)
      .filter(([fieldId, afterValue]) => afterValue !== before.value[fieldId])
      .map(([fieldId, afterValue]) =>
        ({ fieldId, value: afterValue }))
    return { configType: after.value.configType, items }
  })

export const toConfigDeployResult = (
  changes: ModificationChange<InstanceElement>[],
  results: SetConfigRecordsValuesResult,
): DeployResult => {
  if (!_.isArray(results)) {
    return {
      appliedChanges: [],
      errors: [{
        message: results.errorMessage,
        severity: 'Error',
      }],
    }
  }

  const resultsConfigTypes = new Set(results.map(res => res.configType))
  const [success, fail] = _.partition(results, isSuccessSetConfig)
  const configTypeToChange = _(changes)
    .keyBy(change => getChangeData(change).value.configType).value()

  const appliedChanges = success.map(item => configTypeToChange[item.configType])

  const missingResultsError = changes
    .map(getChangeData)
    .filter(instance => !resultsConfigTypes.has(instance.value.configType))
    .map(instance => ({
      elemID: instance.elemID,
      message: 'Failed to deploy instance due to internal server error',
      severity: 'Error' as const,
    }))

  const failResultsErrors = fail.map(item => ({
    elemID: getChangeData(configTypeToChange[item.configType]).elemID,
    message: `${item.configType}: ${item.errorMessage}`,
    severity: 'Error' as const,
  }))

  return { appliedChanges, errors: missingResultsError.concat(failResultsErrors) }
}
