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
import { regex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { BuiltinTypes, createRefToElmWithValue, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { isCriteriaQuery } from '../../config/query'
import { LocalFilterCreator } from '../../filter'
import { isCustomFieldName, isCustomRecordType } from '../../types'
import { CUSTOM_RECORD_TYPE } from '../../constants'
import { shouldExcludeElement } from './exclude_instances'

const log = logger(module)

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'excludeCustomRecordTypes',
  onFetch: async elements => {
    const customRecordTypeCriteria = config.fetch.exclude.types
      .filter(isCriteriaQuery)
      .filter(query => regex.isFullRegexMatch(CUSTOM_RECORD_TYPE, query.name))
    if (customRecordTypeCriteria.length === 0) {
      return
    }
    const removedCustomRecordTypes = _.remove(
      elements,
      element =>
        isObjectType(element) &&
        isCustomRecordType(element) &&
        shouldExcludeElement(element.annotations, customRecordTypeCriteria),
    )
    const removedCustomRecordTypeNames = new Set(removedCustomRecordTypes.map(type => type.elemID.name))
    const removedCustomRecordInstances = _.remove(
      elements,
      element => isInstanceElement(element) && removedCustomRecordTypeNames.has(element.elemID.typeName),
    )
    log.debug(
      'excluding %d custom record types and %d custom record instances by criteria: %o',
      removedCustomRecordTypes.length,
      removedCustomRecordInstances.length,
      removedCustomRecordTypes.map(elem => elem.elemID.getFullName()),
    )

    elements
      .filter(isObjectType)
      .filter(isCustomRecordType)
      .flatMap(type => Object.values(type.fields))
      .filter(field => isCustomFieldName(field.name))
      .filter(field => removedCustomRecordTypeNames.has(field.refType.elemID.name))
      .forEach(field => {
        field.refType = createRefToElmWithValue(BuiltinTypes.UNKNOWN)
      })
  },
})

export default filterCreator
