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
import { regex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ObjectType, Values, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { CriteriaQuery, isCriteriaQuery } from '../query'
import { LocalFilterCreator } from '../filter'
import { isCustomRecordType } from '../types'
import { CUSTOM_RECORD_TYPE } from '../constants'

const log = logger(module)

const shouldExcludeElement = (
  elementValues: Values,
  criteriaQueries: CriteriaQuery[]
): boolean => criteriaQueries.some(query =>
  _.isEqualWith(
    _.pick(elementValues, Object.keys(query.criteria)),
    query.criteria,
    (elemValue: unknown, criteriaValue: unknown) => {
      if (_.isString(elemValue) && _.isString(criteriaValue)) {
        return regex.isFullRegexMatch(elemValue, criteriaValue)
      }
      return undefined
    }
  ))

const createCriteriaByTypeMap = (
  types: ObjectType[],
  criteriaQueries: CriteriaQuery[],
): Record<string, CriteriaQuery[]> => Object.fromEntries(
  types.map(type => type.elemID.name).map(typeName => [
    typeName,
    criteriaQueries.filter(query => regex.isFullRegexMatch(typeName, query.name)),
  ] as [string, CriteriaQuery[]])
)

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'excludeByCriteria',
  onFetch: async elements => {
    const typeCriteriaQueries = config.fetch.exclude.types.filter(isCriteriaQuery)
    const customRecordCriteriaQueries = config.fetch.exclude.customRecords?.filter(isCriteriaQuery) ?? []
    if (typeCriteriaQueries.length === 0 && customRecordCriteriaQueries.length === 0) {
      return
    }
    const [customRecordTypes, types] = _.partition(elements.filter(isObjectType), isCustomRecordType)
    const criteriaByType = createCriteriaByTypeMap(types, typeCriteriaQueries)
    const criteriaByCustomRecordType = createCriteriaByTypeMap(customRecordTypes, customRecordCriteriaQueries)

    const removedCustomRecordTypes = _.remove(elements, element => {
      if (isObjectType(element) && isCustomRecordType(element)) {
        return shouldExcludeElement(element.annotations, criteriaByType[CUSTOM_RECORD_TYPE])
      }
      return false
    })
    const removedCustomRecordTypeNames = new Set(removedCustomRecordTypes.map(type => type.elemID.name))
    const removedInstances = _.remove(elements, element => {
      if (isInstanceElement(element)) {
        const type = element.elemID.typeName
        if (removedCustomRecordTypeNames.has(type)) {
          return true
        }
        const criteria = criteriaByCustomRecordType[type] ?? criteriaByType[type]
        return shouldExcludeElement(element.value, criteria)
      }
      return false
    })
    const removedElements = removedCustomRecordTypes.concat(removedInstances)
    log.debug(
      'excluding %d elements by criteria: %o',
      removedElements.length,
      removedElements.map(elem => elem.elemID.getFullName())
    )
  },
})

export default filterCreator
