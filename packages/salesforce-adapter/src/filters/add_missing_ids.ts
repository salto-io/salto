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
import {
  Element, isObjectType, isInstanceElement, isField,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { apiName, metadataType } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { getFullName, getInternalId, setInternalId } from './utils'

const log = logger(module)

export const getIdsForType = async (
  client: SalesforceClient, type: string,
): Promise<Record<string, string>> => {
  const { result, errors } = await client.listMetadataObjects({ type })
  if (errors && errors.length > 0) {
    log.debug(`Encountered errors while listing ${type}: ${errors}`)
  }
  return Object.fromEntries(
    result
      .filter(info => info.id !== undefined && info.id !== '')
      .map(info => [getFullName(info), info.id])
  )
}

/**
 * Try to add internal ids for the remaining types using listMetadataObjects.
 *
 * @param client          The salesforce client to use for the query
 * @param elementsByType  Elements missing internal ids, grouped by type
 */
const addMissingIds = async (
  client: SalesforceClient,
  typeName: string,
  elements: Element[],
): Promise<void> => {
  const allIds = await getIdsForType(client, typeName)
  elements.forEach(element => {
    const id = allIds[apiName(element)]
    if (id !== undefined) {
      setInternalId(element, id)
    }
  })
}

const elementsWithMissingIds = (elements: Element[]): Element[] => (
  elements
    .flatMap(e => (isObjectType(e) ? Object.values(e.fields) : [e]))
    .filter(e => (isInstanceElement(e) && !e.getType().isSettings) || isField(e))
    .filter(e => apiName(e) !== undefined && getInternalId(e) === undefined)
)

/**
 * Add missing env-specific ids using listMetadataObjects.
 */
const filter: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]) => {
    const groupedElements = _.groupBy(
      elementsWithMissingIds(elements),
      metadataType,
    )
    log.debug(`Getting missing ids for the following types: ${Object.keys(groupedElements)}`)
    await Promise.all(
      Object.entries(groupedElements)
        .map(([typeName, typeElements]) => addMissingIds(client, typeName, typeElements))
    )
  },
})

export default filter
