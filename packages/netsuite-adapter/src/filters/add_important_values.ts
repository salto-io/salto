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
import { CORE_ANNOTATIONS, ObjectType, isObjectType } from '@salto-io/adapter-api'
import { ImportantValues, toImportantValues } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { isCustomRecordType, netsuiteSupportedTypes } from '../types'
import { BUNDLE, CUSTOM_RECORD_TYPE, INACTIVE_FIELDS, NAME_FIELD, SCRIPT_ID } from '../constants'

const log = logger(module)

const { IMPORTANT_VALUES, SELF_IMPORTANT_VALUES } = CORE_ANNOTATIONS

const HIGHLIGHTED_FIELD_NAMES = [NAME_FIELD, 'label', 'description', SCRIPT_ID]
const HIGHLIGHTED_AND_INDEXED_FIELD_NAMES = [...Object.values(INACTIVE_FIELDS), BUNDLE]

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
  {
    value: BUNDLE,
    highlighted: true,
    indexed: true,
  },
]

const getImportantValues = (type: ObjectType): ImportantValues => [
  ...toImportantValues(type, HIGHLIGHTED_FIELD_NAMES, { highlighted: true }),
  ...toImportantValues(type, HIGHLIGHTED_AND_INDEXED_FIELD_NAMES, { indexed: true, highlighted: true }),
]

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'addImportantValues',
  onFetch: async elements => {
    if (config.fetch.addImportantValues === false) {
      log.info('addImportantValues is disabled')
      return
    }

    const [customRecordTypes, types] = _.partition(elements.filter(isObjectType), isCustomRecordType)

    const netsuiteSupportedTypesSet = new Set(netsuiteSupportedTypes)
    types
      .filter(type => netsuiteSupportedTypesSet.has(type.elemID.name) && !type.isSettings)
      .forEach(type => {
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
