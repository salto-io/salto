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
import { logger } from '@salto-io/logging'
import { CORE_ANNOTATIONS, ObjectType, isObjectType } from '@salto-io/adapter-api'
import { ImportantValues } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { isCustomRecordType, netsuiteSupportedTypes } from '../types'
import { CUSTOM_RECORD_TYPE, INACTIVE_FIELDS, NAME_FIELD, SCRIPT_ID } from '../constants'

const log = logger(module)

const { IMPORTANT_VALUES, SELF_IMPORTANT_VALUES } = CORE_ANNOTATIONS

const HIGHLIGHTED_FIELD_NAMES = [NAME_FIELD, 'label', 'description', SCRIPT_ID]

const customRecordInstancesImportantValues = (): ImportantValues => [
  {
    value: NAME_FIELD,
    highlighted: true,
    indexed: false,
  },
  {
    value: SCRIPT_ID,
    highlighted: true,
    indexed: false,
  },
  {
    value: INACTIVE_FIELDS.isInactive,
    highlighted: true,
    indexed: true,
  },
]

const toHighlightedImportantValues = (
  type: ObjectType,
  fieldNames: string[]
): ImportantValues => fieldNames
  .filter(fieldName => type.fields[fieldName] !== undefined)
  .map(fieldName => ({
    value: fieldName,
    highlighted: true,
    indexed: false,
  }))

const toIndexedHighlightedImportantValues = (
  type: ObjectType,
  fieldNames: string[]
): ImportantValues => fieldNames
  .filter(fieldName => type.fields[fieldName] !== undefined)
  .map(fieldName => ({
    value: fieldName,
    highlighted: true,
    indexed: true,
  }))

const getImportantValues = (type: ObjectType): ImportantValues => [
  ...toHighlightedImportantValues(type, HIGHLIGHTED_FIELD_NAMES),
  ...toIndexedHighlightedImportantValues(type, Object.values(INACTIVE_FIELDS)),
]

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'addImportantValues',
  onFetch: async elements => {
    if (config.fetch.addImportantValues !== true) {
      log.info('addImportantValues is disabled')
      return
    }

    const [customRecordTypes, types] = _.partition(
      elements.filter(isObjectType),
      isCustomRecordType
    )

    const netsuiteSupportedTypesSet = new Set(netsuiteSupportedTypes)
    types.filter(type => netsuiteSupportedTypesSet.has(type.elemID.name)).forEach(type => {
      const importantValues = getImportantValues(type)
      if (importantValues.length > 0) {
        type.annotations[IMPORTANT_VALUES] = importantValues
      }
    })

    const customRecordType = types.find(type => type.elemID.name === CUSTOM_RECORD_TYPE)
    customRecordTypes.forEach(type => {
      type.annotations[SELF_IMPORTANT_VALUES] = customRecordType?.annotations[IMPORTANT_VALUES]
      type.annotations[IMPORTANT_VALUES] = customRecordInstancesImportantValues()
    })
  },
})

export default filterCreator
