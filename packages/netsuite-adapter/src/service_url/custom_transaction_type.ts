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
import NetsuiteClient from '../client/client'
import { ServiceUrlSetter } from './types'
import { areQueryResultsValid } from './validation'

const getScriptIdToInternalId = async (client: NetsuiteClient): Promise<Record<string, number>> => {
  const results = await client.runSuiteQL('SELECT id, scriptid FROM customtransactiontype')
  if (!areQueryResultsValid(results)) {
    throw new Error('Got invalid results from custom transaction type query')
  }

  return Object.fromEntries(
    results.map(({ scriptid, id }) => [scriptid, parseInt(id, 10)])
  )
}

const setServiceUrl: ServiceUrlSetter = async (elements, client) => {
  const relevantElements = elements
    .filter(isInstanceElement)
    .filter(element => element.type.elemID.name === 'customtransactiontype')

  if (relevantElements.length === 0) {
    return
  }

  const scriptIdToInternalId = await getScriptIdToInternalId(client)

  relevantElements.forEach(element => {
    const id = scriptIdToInternalId[element.value.scriptid]
    if (id !== undefined) {
      element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(`app/common/custom/customtransaction.nl?id=${id}`, client.url).href
    }
  })
}

export default setServiceUrl
