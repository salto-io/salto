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
import os from 'os'
import _ from 'lodash'
import { BuiltinTypes, CORE_ANNOTATIONS, Element, ElemID, FieldDefinition, getChangeData, InstanceElement, ListType, ModificationChange, ObjectType, TypeElement } from '@salto-io/adapter-api'
import { NETSUITE, SELECT_OPTION, SETTINGS_PATH, TYPES_PATH } from '../../constants'
import { ConfigFieldDefinition, ConfigRecord, isSuccessSetConfig, SetConfigRecordsValuesResult, SetConfigType } from './types'
import { SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES, DeployResult } from '../../types'

const CHECKBOX_TYPE = 'checkbox'
const INTEGER_TYPE = 'integer'
const SELECT_TYPE = 'select'
const MULTISELECT_TYPE = 'multiselect'
const FIELD_TYPES_TO_OMIT = [
  'never',
  'help',
  'inlinehtml',
  'label',
  'text',
  'textarea',
]

const fieldUtils = (): {
  selectOptionType: ObjectType
  toFields: (fieldsDef: ConfigFieldDefinition[]) => Record<string, FieldDefinition>
} => {
  const selectOptionType = new ObjectType({
    elemID: new ElemID(NETSUITE, SELECT_OPTION),
    fields: {
      text: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.UNKNOWN },
    },
    path: [NETSUITE, TYPES_PATH, SELECT_OPTION],
  })

  const multiSelectOptionType = new ListType(selectOptionType)

  const toFieldType = (type: string): TypeElement => {
    switch (type) {
      case CHECKBOX_TYPE:
        return BuiltinTypes.BOOLEAN
      case INTEGER_TYPE:
        return BuiltinTypes.NUMBER
      case SELECT_TYPE:
        return selectOptionType
      case MULTISELECT_TYPE:
        return multiSelectOptionType
      default:
        return BuiltinTypes.STRING
    }
  }

  const toFields = (fieldsDef: ConfigFieldDefinition[]): Record<string, FieldDefinition> => ({
    ..._(fieldsDef)
      .filter(field => !FIELD_TYPES_TO_OMIT.includes(field.type))
      .keyBy(field => field.id)
      .mapValues(({ label, type }) => ({
        refType: toFieldType(type),
        annotations: {
          label,
          type,
        },
      }))
      .value(),
    configType: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      },
    },
  })

  return { selectOptionType, toFields }
}

export const getConfigRecordElements = (
  configRecords: ConfigRecord[],
): Element[] => {
  const { selectOptionType, toFields } = fieldUtils()

  const elements = configRecords
    .flatMap(configRecord => {
      const typeName = SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES[configRecord.configType]
      const configRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, typeName),
        fields: toFields(configRecord.fieldsDef),
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

  return elements.concat(selectOptionType)
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
    return { appliedChanges: [], errors: [new Error(results.errorMessage)] }
  }

  const [success, fail] = _.partition(results, isSuccessSetConfig)
  const configTypeToChange = _(changes)
    .keyBy(change => getChangeData(change).value.configType).value()

  const appliedChanges = success.map(item => configTypeToChange[item.configType])

  if (changes.length === results.length && fail.length === 0) {
    return { appliedChanges, errors: [] }
  }

  const missingResultsError = changes.length !== results.length
    ? [new Error('Missing deploy result for some changes')]
    : []

  const failResultsErrors = fail.length > 0
    ? [new Error(fail.map(item => `${item.configType}: ${item.errorMessage}`).join(os.EOL))]
    : []

  return { appliedChanges, errors: missingResultsError.concat(failResultsErrors) }
}
