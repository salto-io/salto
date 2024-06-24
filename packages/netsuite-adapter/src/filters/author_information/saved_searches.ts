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
import { isInstanceElement, CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Ajv from 'ajv'
import _ from 'lodash'
import moment from 'moment-timezone'
import { SAVED_SEARCH, SCRIPT_ID } from '../../constants'
import { RemoteFilterCreator } from '../../filter'
import NetsuiteClient from '../../client/client'
import { SavedSearchesResult, SAVED_SEARCH_RESULT_SCHEMA, ModificationInformation } from './constants'
import { TimeZoneAndFormat } from '../../changes_detector/date_formats'

const log = logger(module)

const isSavedSearchInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === SAVED_SEARCH

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
        dateString: datemodified,
        datemodified: toMomentDate(datemodified, { timeZone, format }),
      }))
      .filter(({ modifiedby, datemodified, dateString }) => {
        if (!datemodified.isValid()) {
          log.warn('dropping invalid date: %s', dateString)
          return false
        }
        if (now.isBefore(datemodified)) {
          log.warn('dropping future date: %s > %s (now)', datemodified.format(), now.format())
          return false
        }
        return modifiedby.length > 0
      })
      .map(savedSearch => [
        savedSearch.id,
        {
          lastModifiedBy: savedSearch.modifiedby[0].text,
          lastModifiedAt: savedSearch.datemodified.format(),
        },
      ]),
  )
}

const filterCreator: RemoteFilterCreator = ({ client, config, elementsSourceIndex, timeZoneAndFormat }) => ({
  name: 'savedSearchesAuthorInformation',
  remote: true,
  onFetch: async elements => {
    // if undefined, we want to be treated as true so we check `=== false`
    if (config.fetch.authorInformation?.enable === false) {
      log.debug('Author information fetching is disabled')
      return
    }
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const savedSearchesInstances = elements.filter(isInstanceElement).filter(isSavedSearchInstance)
    if (_.isEmpty(savedSearchesInstances)) {
      return
    }
    const { elemIdToChangeByIndex, elemIdToChangeAtIndex } = await elementsSourceIndex.getIndexes()
    if (timeZoneAndFormat?.format === undefined) {
      savedSearchesInstances.forEach(instance => {
        instance.annotate({ [CORE_ANNOTATIONS.CHANGED_BY]: elemIdToChangeByIndex[instance.elemID.getFullName()] })
        instance.annotate({ [CORE_ANNOTATIONS.CHANGED_AT]: elemIdToChangeAtIndex[instance.elemID.getFullName()] })
      })
      return
    }
    const savedSearchesMap = await getSavedSearchesMap(client, timeZoneAndFormat)
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
