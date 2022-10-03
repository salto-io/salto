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
import { isInstanceElement, CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Ajv from 'ajv'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { SUITEQL_DATE_FORMAT } from '../../changes_detector/date_formats'
import { SAVED_SEARCH } from '../../constants'
import { FilterCreator, FilterWith } from '../../filter'
import NetsuiteClient from '../../client/client'
import { SavedSearchesResult, SAVED_SEARCH_RESULT_SCHEMA, reducedSystemNote } from './constants'

const log = logger(module)
const { isDefined } = values
export const INNER_DATE_FORMAT = 'M/D/YYYY'
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
): Promise<Record<string, reducedSystemNote>> => {
  const savedSearches = await fetchSavedSearches(client)
  return Object.fromEntries(savedSearches.map(savedSearch => [
    savedSearch.id,
    {
      name: savedSearch.modifiedby[0]?.text, date: savedSearch.datemodified?.split(' ')[0],
    },
  ]))
}

const changeDateFormat = (date: string, dateFormat: string): string => {
  if (dateFormat === INNER_DATE_FORMAT || dateFormat === SUITEQL_DATE_FORMAT) {
    return date
  }
  const dateAsArray = date.split('/')
  const dateFormatAsArray = dateFormat?.split('/')
  const dateAsMap: Record<string, string> = {}
  dateFormatAsArray.forEach((key, i) => {
    dateAsMap[key] = dateAsArray[i]
  })
  return [dateAsMap.M, dateAsMap.D, dateAsMap.YYYY].join('/')
}
const isUserPreference = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === 'userPreferences'

const filterCreator: FilterCreator = ({ client, config }): FilterWith<'onFetch'> => ({
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

    const dateFormat = elements
      .filter(isInstanceElement)
      .filter(isUserPreference)[0]?.value.configRecord.data.fields?.DATEFORMAT?.text

    const savedSearchesMap = await getSavedSearchesMap(client)

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
