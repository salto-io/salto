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
import { isInstanceElement, CORE_ANNOTATIONS, InstanceElement, ReadOnlyElementsSource, ElemID, Element } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Ajv from 'ajv'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import moment from 'moment-timezone'
import { SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../../types'
import { NETSUITE, SAVED_SEARCH } from '../../constants'
import { FilterCreator, FilterWith } from '../../filter'
import NetsuiteClient from '../../client/client'
import { SavedSearchesResult,
  SAVED_SEARCH_RESULT_SCHEMA,
  ModificationInformation } from './constants'

const log = logger(module)
const { isDefined } = values

type TimeZoneAndFormat = {
  timeZone: string
  timeFormat: string
  dateFormat: string
}

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

export const changeDateFormat = (date: string, dateFormat: string, timeZone: string, timeFormat: string): string => {
  const utcDate = moment.tz(date, [dateFormat.replace('Month', 'MMMM'), timeFormat].join(' '), timeZone)
  const returnTemp = utcDate.utc().format()
  return returnTemp
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

const getTimeZoneFromElemSource = async (
  elementsSource: ReadOnlyElementsSource
): Promise<string> => {
  const elemIdToGet = new ElemID(NETSUITE, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES.USER_PREFERENCES, 'instance')
  const sourcedElement = await elementsSource.get(elemIdToGet)
  return sourcedElement?.value?.TIMEZONE?.value
}

const getTimeFormatFromElemSource = async (
  elementsSource: ReadOnlyElementsSource
): Promise<string> => {
  const elemIdToGet = new ElemID(NETSUITE, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES.USER_PREFERENCES, 'instance')
  const sourcedElement = await elementsSource.get(elemIdToGet)
  return sourcedElement?.value?.TIMEFORMAT?.value
}

export const getZoneAndFormat = async (
  elements: Element[],
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean
): Promise<TimeZoneAndFormat> => {
  const userPreferencesInstance = elements.filter(isInstanceElement).find(isUserPreference)
  const timeZone = userPreferencesInstance?.value.configRecord.data.fields?.TIMEZONE?.value ?? (
    isPartial ? await getTimeZoneFromElemSource(elementsSource) : undefined
  )
  const timeFormat = userPreferencesInstance?.value.configRecord.data.fields?.TIMEFORMAT?.value ?? (
    isPartial ? await getTimeFormatFromElemSource(elementsSource) : undefined
  )
  const dateFormat = userPreferencesInstance?.value.configRecord.data.fields?.DATEFORMAT?.text ?? (
    isPartial ? await getDateFormatFromElemSource(elementsSource) : undefined
  )
  return { timeZone, timeFormat, dateFormat }
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

    const { timeZone, timeFormat, dateFormat } = await getZoneAndFormat(elements, elementsSource, isPartial)

    savedSearchesInstances.forEach(search => {
      if (isDefined(savedSearchesMap[search.value.scriptid])) {
        const { name, date } = savedSearchesMap[search.value.scriptid]
        if (isDefined(name)) {
          search.annotate(
            { [CORE_ANNOTATIONS.CHANGED_BY]: name }
          )
        }
        if (isDefined(date) && isDefined(dateFormat)) {
          const annotationDate = changeDateFormat(date, dateFormat, timeZone, timeFormat)
          search.annotate(
            { [CORE_ANNOTATIONS.CHANGED_AT]: annotationDate }
          )
        }
      }
    })
  },
})

export default filterCreator
