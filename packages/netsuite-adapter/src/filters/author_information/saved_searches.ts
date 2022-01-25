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
import { SAVED_SEARCH } from '../../constants'
import { FilterCreator, FilterWith } from '../../filter'
import NetsuiteClient from '../../client/client'
import { SavedSearchesResult, SAVED_SEARCH_RESULT_SCHEMA } from './constants'

const log = logger(module)
const { isDefined } = values
const isSavedSearchInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === SAVED_SEARCH

const fetchSavedSearches = async (client: NetsuiteClient): Promise<SavedSearchesResult[]> => {
  const savedSearches = await client.runSavedSearchQuery({
    type: 'savedsearch',
    columns: ['modifiedby', 'id'],
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

const getSavedSearchesModifiersMap = async (
  client: NetsuiteClient,
): Promise<Record<string, string>> => {
  const savedSearches = await fetchSavedSearches(client)
  return Object.fromEntries(savedSearches.map(savedSearch =>
    (_.isEmpty(savedSearch.modifiedby) ? [] : [savedSearch.id, savedSearch.modifiedby[0].text])))
}

const filterCreator: FilterCreator = ({ client }): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const savedSearchesInstances = elements
      .filter(isInstanceElement)
      .filter(isSavedSearchInstance)
    if (_.isEmpty(savedSearchesInstances)) {
      return
    }
    const savedSearchesMap = await getSavedSearchesModifiersMap(client)
    if (_.isEmpty(savedSearchesMap)) {
      return
    }
    savedSearchesInstances.forEach(search => {
      if (isDefined(savedSearchesMap[search.value.scriptid])) {
        search.annotate({ [CORE_ANNOTATIONS.CHANGED_BY]: savedSearchesMap[search.value.scriptid] })
      }
    })
  },
})

export default filterCreator
