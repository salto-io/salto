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
import { isInstanceElement, CORE_ANNOTATIONS, InstanceElement, ReadOnlyElementsSource, ElemID, Element } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Ajv from 'ajv'
import _ from 'lodash'
import moment from 'moment-timezone'
import { SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../../types'
import { NETSUITE, SAVED_SEARCH, SCRIPT_ID } from '../../constants'
import { FilterCreator, FilterWith } from '../../filter'
import NetsuiteClient from '../../client/client'
import { SavedSearchesResult, SAVED_SEARCH_RESULT_SCHEMA, ModificationInformation } from './constants'

const log = logger(module)

type TimeZoneAndFormat = {
  timeZone?: string
  format?: string | moment.MomentBuiltinFormat
}

const TIMEZONE = 'TIMEZONE'
const TIMEFORMAT = 'TIMEFORMAT'
const DATEFORMAT = 'DATEFORMAT'

const isSavedSearchInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === SAVED_SEARCH

const fetchSavedSearches = async (
  client: NetsuiteClient,
): Promise<SavedSearchesResult[]> => {
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

export const toMomentDate = (date: string, timeAndFormat: TimeZoneAndFormat): moment.Moment => {
  const { timeZone, format } = timeAndFormat
  if (!timeZone) {
    return moment.utc(date, format)
  }
  if (!format) {
    return moment.tz(date, timeZone).utc()
  }
  return moment.tz(date, format, timeZone).utc()
}

const getSavedSearchesMap = async (
  client: NetsuiteClient,
  { timeZone, format }: TimeZoneAndFormat,
): Promise<Record<string, ModificationInformation>> => {
  const savedSearches = await fetchSavedSearches(client)
  const now = timeZone ? moment.tz(timeZone).utc() : moment().utc()
  return Object.fromEntries(
    savedSearches
      .map(({ datemodified, ...item }) => ({
        ...item,
        datemodified: toMomentDate(datemodified, { timeZone, format }),
      }))
      .filter(({ modifiedby, datemodified }) => modifiedby.length > 0 && !now.isBefore(datemodified))
      .map(savedSearch => [
        savedSearch.id,
        {
          lastModifiedBy: savedSearch.modifiedby[0].text,
          lastModifiedAt: savedSearch.datemodified.format(),
        },
      ])
  )
}

const isUserPreference = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES.USER_PREFERENCES

const mapFieldToValue: Record<string, string> = {
  [TIMEFORMAT]: 'value',
  [TIMEZONE]: 'value',
  [DATEFORMAT]: 'text',
}

const getFieldFromElemSource = async (
  elementsSource: ReadOnlyElementsSource,
  field: string,
): Promise<string | undefined> => {
  const elemIdToGet = new ElemID(NETSUITE, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES.USER_PREFERENCES, 'instance')
  const sourcedElement = await elementsSource.get(elemIdToGet)
  return sourcedElement?.value?.[field]?.[mapFieldToValue[field]]
}

const getTimeAndDateValue = async (
  field: string,
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
  userPreferencesInstance: InstanceElement | undefined
): Promise<string | undefined> => {
  const returnField = userPreferencesInstance?.value.configRecord.data.fields?.[field] ?? (
    isPartial ? await getFieldFromElemSource(elementsSource, field) : undefined
  )
  return returnField
}

export const getZoneAndFormat = async (
  elements: Element[],
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean
): Promise<TimeZoneAndFormat> => {
  const userPreferencesInstance = elements.filter(isInstanceElement).find(isUserPreference)
  const timeZone = await getTimeAndDateValue(TIMEZONE, elementsSource, isPartial, userPreferencesInstance)
  const timeFormat = await getTimeAndDateValue(TIMEFORMAT, elementsSource, isPartial, userPreferencesInstance)
  const dateFormat = await getTimeAndDateValue(DATEFORMAT, elementsSource, isPartial, userPreferencesInstance)
  const format = dateFormat && timeFormat
    // replace 'Month' with 'MMMM' since moment.tz doesn't support the 'D Month, YYYY' netsuite date format
    ? [dateFormat.replace('Month', 'MMMM'), timeFormat.toLowerCase()].join(' ')
    : undefined

  return { timeZone, format }
}

const filterCreator: FilterCreator = ({ client, config, elementsSource, isPartial, elementsSourceIndex }): FilterWith<'onFetch'> => ({
  name: 'savedSearchesAuthorInformation',
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
    const timeZoneAndFormat = await getZoneAndFormat(elements, elementsSource, isPartial)
    if (timeZoneAndFormat.format === undefined) {
      return
    }
    const savedSearchesMap = await getSavedSearchesMap(client, timeZoneAndFormat)
    const { elemIdToChangeByIndex, elemIdToChangeAtIndex } = await elementsSourceIndex.getIndexes()
    if (_.isEmpty(savedSearchesMap) && _.isEmpty(elemIdToChangeByIndex) && _.isEmpty(elemIdToChangeAtIndex)) {
      return
    }
    savedSearchesInstances.forEach(instance => {
      const result = savedSearchesMap[instance.value[SCRIPT_ID]]
      if (result !== undefined) {
        instance.annotate({ [CORE_ANNOTATIONS.CHANGED_BY]: result.lastModifiedBy })
        instance.annotate({ [CORE_ANNOTATIONS.CHANGED_AT]: result.lastModifiedAt })
      } else {
        instance.annotate({ [CORE_ANNOTATIONS.CHANGED_BY]: elemIdToChangeByIndex[instance.elemID.getFullName()] })
        instance.annotate({ [CORE_ANNOTATIONS.CHANGED_AT]: elemIdToChangeAtIndex[instance.elemID.getFullName()] })
      }
    })
  },
})

export default filterCreator
