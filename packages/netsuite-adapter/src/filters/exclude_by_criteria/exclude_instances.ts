/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { regex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ObjectType, Values, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { isCriteriaQuery } from '../../config/query'
import { CriteriaQuery } from '../../config/types'
import { LocalFilterCreator } from '../../filter'
import { isCustomRecordType } from '../../types'

const log = logger(module)

export const shouldExcludeElement = (elementValues: Values, criteriaQueries: CriteriaQuery[]): boolean =>
  criteriaQueries.some(query =>
    _.isEqualWith(
      _.pick(elementValues, Object.keys(query.criteria)),
      query.criteria,
      (elemValue: unknown, criteriaValue: unknown) => {
        if (_.isString(elemValue) && _.isString(criteriaValue)) {
          return regex.isFullRegexMatch(elemValue, criteriaValue)
        }
        // returning undefined makes lodash to handle the comparison (using isEqual)
        return undefined
      },
    ),
  )

const createCriteriaByTypeMap = (
  types: ObjectType[],
  criteriaQueries: CriteriaQuery[],
): Record<string, CriteriaQuery[]> =>
  Object.fromEntries(
    types
      .map(type => type.elemID.name)
      .map(
        typeName =>
          [typeName, criteriaQueries.filter(query => regex.isFullRegexMatch(typeName, query.name))] as [
            string,
            CriteriaQuery[],
          ],
      ),
  )

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'excludeInstances',
  onFetch: async elements => {
    const typeCriteriaQueries = config.fetch.exclude.types.filter(isCriteriaQuery)
    const customRecordCriteriaQueries = config.fetch.exclude.customRecords?.filter(isCriteriaQuery) ?? []
    if (typeCriteriaQueries.length === 0 && customRecordCriteriaQueries.length === 0) {
      return
    }
    const [customRecordTypes, types] = _.partition(elements.filter(isObjectType), isCustomRecordType)
    const criteriaByType = {
      ...createCriteriaByTypeMap(types, typeCriteriaQueries),
      ...createCriteriaByTypeMap(customRecordTypes, customRecordCriteriaQueries),
    }
    const removedInstances = _.remove(
      elements,
      element =>
        isInstanceElement(element) && shouldExcludeElement(element.value, criteriaByType[element.elemID.typeName]),
    )
    log.debug(
      'excluding %d instances by criteria: %o',
      removedInstances.length,
      removedInstances.map(elem => elem.elemID.getFullName()),
    )
  },
})

export default filterCreator
