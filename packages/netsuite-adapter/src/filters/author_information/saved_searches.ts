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
import { isInstanceElement, CORE_ANNOTATIONS, InstanceElement, ReadOnlyElementsSource, ElemID } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Ajv from 'ajv'
import { values } from '@salto-io/lowerdash'
import _, { isUndefined } from 'lodash'
import { SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../../types'
import { NETSUITE, SAVED_SEARCH } from '../../constants'
import { FilterCreator, FilterWith } from '../../filter'
import NetsuiteClient from '../../client/client'
import { SavedSearchesResult,
  SAVED_SEARCH_RESULT_SCHEMA,
  ModificationInformation,
  INNER_DATE_FORMAT,
  DateKeys } from './constants'

const log = logger(module)
const { isDefined } = values
const DELIMITER = '*'

const isSavedSearchInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === SAVED_SEARCH

const fetchSavedSearches = async (client: NetsuiteClient): Promise<SavedSearchesResult[]> => {
  const savedSearches = await client.runSavedSearchQuery({
    type: 'savedsearch',
    columns: ['modifiedby', 'id', 'datemodified'],
    filters: [],
  })
  if (savedSearches === undefined) {
    return []
  }
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<SavedSearchesResult[]>(SAVED_SEARCH_RESULT_SCHEMA, savedSearches)) {
    log.error(`Got invalid results from searching saved searches: ${ajv.errorsText()}`)
    return []
  }
  return savedSearches
}

const getSavedSearchesMap = async (
  client: NetsuiteClient,
): Promise<Record<string, ModificationInformation>> => {
  const savedSearches = await fetchSavedSearches(client)
  return Object.fromEntries(savedSearches.map(savedSearch => [
    savedSearch.id,
    {
      name: savedSearch.modifiedby[0]?.text, date: savedSearch.datemodified,
    },
  ]))
}

const getDateFormatKey = (key: string): DateKeys => {
  if (key.includes('Y')) {
    return 'YYYY'
  }
  if (key.includes('M')) {
    return 'M'
  }
  return 'D'
}

const getFullTime = (timeArray: string[]): string | undefined => {
  if (isUndefined(timeArray)) {
    return undefined
  }
  return timeArray[1] === 'am' ? '0'.concat(timeArray[0]) : timeArray[0]
}

export const changeDateFormat = (date: string, dateFormat: string): string => {
  const re = /(-|\.| |\/|,)+/g
  const dateAsArray = date.replace(re, DELIMITER).split(DELIMITER)
  const dateFormatKeysArray = dateFormat
    .replace(re, DELIMITER).split(DELIMITER).map(getDateFormatKey)
  const dateAsMap: Record<DateKeys, string> = { YYYY: '', M: '', D: '' }
  dateFormatKeysArray.forEach((key, i) => {
    dateAsMap[key] = dateAsArray[i]
  })
  const time = dateAsArray.length === 5 ? getFullTime(dateAsArray.slice(3)) : undefined
  const formatedDate = [dateAsMap.M, dateAsMap.D, dateAsMap.YYYY].join('/')
  const returnDate = time ? [formatedDate, time].join(' ') : formatedDate
  return new Date(returnDate.concat('Z')).toISOString()
}

const isUserPreference = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES.USER_PREFERENCES

const getDateFormatFromElemSource = async (
  elementsSource: ReadOnlyElementsSource
): Promise<string> => {
  const elemIdToGet = new ElemID(NETSUITE, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES.USER_PREFERENCES, 'instance')
  const sourcedElement = await elementsSource.get(elemIdToGet)
  return sourcedElement?.value?.DATEFORMAT?.text
}

const filterCreator: FilterCreator = ({ client, config, elementsSource, isPartial }): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    // if undefined, we want to be treated as true so we check `=== false`
    if (config.fetch?.authorInformation?.enable === false) {
      log.debug('Author information fetching is disabled')
      return
    }

    if (!client.isSuiteAppConfigured()) {
      return
    }
    const savedSearchesInstances = elements
      .filter(isInstanceElement)
      .filter(isSavedSearchInstance)
    if (_.isEmpty(savedSearchesInstances)) {
      return
    }

    const savedSearchesMap = await getSavedSearchesMap(client)
    if (_.isEmpty(savedSearchesMap)) {
      return
    }

    const dateFormat = elements
      .filter(isInstanceElement)
      .find(isUserPreference)?.value.configRecord.data.fields?.DATEFORMAT?.text ?? (
        isPartial ? await getDateFormatFromElemSource(elementsSource) : undefined
      )

    savedSearchesInstances.forEach(search => {
      if (isDefined(savedSearchesMap[search.value.scriptid])) {
        const { name, date } = savedSearchesMap[search.value.scriptid]
        if (isDefined(name)) {
          search.annotate(
            { [CORE_ANNOTATIONS.CHANGED_BY]: name }
          )
        }
        if (isDefined(date) && isDefined(dateFormat)) {
          const annotationDate = changeDateFormat(date, dateFormat)
          search.annotate(
            { [CORE_ANNOTATIONS.CHANGED_AT]: annotationDate }
          )
        }
      }
    })
  },
})

export default filterCreator
