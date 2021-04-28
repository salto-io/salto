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

import { InstanceElement, isInstanceElement, Element, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import NetsuiteClient from '../client/client'
import { areQueryResultsValid } from './validation'

const log = logger(module)

const getScriptIdToInternalId = async (
  client: NetsuiteClient,
  query: string
): Promise<Record<string, number>> => {
  const results = await client.runSuiteQL(query)
  if (!areQueryResultsValid(results)) {
    throw new Error('Got invalid results from SuiteQL query')
  }

  return Object.fromEntries(
    results.map(({ scriptid, id }) => [scriptid.toLowerCase(), parseInt(id, 10)])
  )
}

export const setInstancesUrls = async (
  elements: Element[],
  client: NetsuiteClient,
  filter: (element: InstanceElement) => boolean,
  query: string,
  generateUrl: (id: number, element: InstanceElement) => string | undefined,
  elementToId: (element: InstanceElement) => string = element => element.value.scriptid,
): Promise<void> => {
  const relevantElements = elements
    .filter(isInstanceElement)
    .filter(e => filter(e))

  if (relevantElements.length === 0) {
    return
  }

  const scriptIdToInternalId = await getScriptIdToInternalId(client, query)

  relevantElements.forEach(element => {
    const id = scriptIdToInternalId[elementToId(element).toLowerCase()]
    if (id === undefined) {
      log.warn(`Did not find the internal id of ${element.elemID.getFullName()}`)
      return
    }
    const url = generateUrl(id, element)
    if (url !== undefined) {
      element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(url, client.url).href
    }
  })
}
