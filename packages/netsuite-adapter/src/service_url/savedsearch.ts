/*
*                      Copyright 2021 Salto Labs Ltd.
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

import { CORE_ANNOTATIONS, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import NetsuiteClient from '../client/client'
import { ServiceUrlSetter } from './types'
import { areSavedSearchResultsValid } from './validation'

const log = logger(module)


const getScriptIdToInternalId = async (client: NetsuiteClient): Promise<Record<string, number>> => {
  const results = await client.runSavedSearchQuery({ type: 'savedsearch', filters: [], columns: ['id', 'internalid'] })
  if (!areSavedSearchResultsValid(results)) {
    throw new Error('Got invalid results from savedsearch query')
  }

  return Object.fromEntries(
    results.map(({ id, internalid }) => [id, parseInt(internalid[0].value, 10)])
  )
}

const setServiceUrl: ServiceUrlSetter = async (elements, client) => {
  const relevantElements = elements
    .filter(isInstanceElement)
    .filter(element => element.refType.elemID.name === 'savedsearch')

  if (relevantElements.length === 0) {
    return
  }

  const scriptIdToInternalId = await getScriptIdToInternalId(client)

  relevantElements.forEach(element => {
    const id = scriptIdToInternalId[element.value.scriptid]
    if (id !== undefined) {
      element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(`app/common/search/search.nl?cu=T&id=${id}`, client.url).href
    } else {
      log.warn(`Did not find the internal id of ${element.elemID.getFullName()}`)
    }
  })
}

export default setServiceUrl
