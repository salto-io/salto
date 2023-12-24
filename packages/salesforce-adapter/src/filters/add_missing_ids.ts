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
import {
  Element, isObjectType, isField, isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { RemoteFilterCreator } from '../filter'
import { apiName, metadataType } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import {
  getFullName,
  getInternalId,
  setInternalId,
  ensureSafeFilterFetch,
  isMetadataInstanceElementSync,
  isStandardField,
} from './utils'

const log = logger(module)
const { awu, groupByAsync } = collections.asynciterable


const shouldElementHaveInternalId = (element: Element): boolean => {
  if (isInstanceElement(element)) {
    return !element.getTypeSync().isSettings
    && isMetadataInstanceElementSync(element)
  } if (isField(element)) {
    return !isStandardField(element)
  }
  return false
}

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
): Promise<Element[]> => {
  const errorElements: Element[] = []
  const allIds = await getIdsForType(client, typeName)
  await awu(elements).forEach(async element => {
    const id = allIds[await apiName(element)]
    if (id !== undefined) {
      setInternalId(element, id)
    } else {
      errorElements.push(element)
    }
  })
  return errorElements
}

const elementsWithMissingIds = async (elements: Element[]): Promise<Element[]> => (
  awu(elements)
    .flatMap(e => (isObjectType(e) ? Object.values(e.fields) : [e]))
    .filter(async e => (isInstanceElement(e) && !(await e.getType()).isSettings) || isField(e))
    .filter(async e => await apiName(e) !== undefined && getInternalId(e) === undefined)
    .toArray()
)

export const WARNING_MESSAGE = 'Encountered an error while trying populate internal IDs for some of your salesforce configuration elements. This might result in some missing configuration dependencies in your workspace and/or affect the availability of the ‘go to service’ functionality.'

/**
 * Add missing env-specific ids using listMetadataObjects.
 */
const filter: RemoteFilterCreator = ({ client, config }) => ({
  name: 'addMissingIdsFilter',
  remote: true,
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    filterName: 'addMissingIds',
    fetchFilterFunc: async (elements: Element[]) => {
      const groupedElements = await groupByAsync(
        await elementsWithMissingIds(elements),
        metadataType,
      )
      log.debug(`Getting missing ids for the following types: ${Object.keys(groupedElements)}`)
      const errorElements = (await Promise.all(
        Object.entries(groupedElements)
          .map(([typeName, typeElements]) => addMissingIds(client, typeName, typeElements))
      ))
        .flat()
        .filter(shouldElementHaveInternalId)
      if (errorElements.length > 0) {
        log.debug('Could not add internalIds on the following elements: %s', safeJsonStringify(errorElements.map(e => e.elemID.getFullName())))
      }
    },
  }),
})

export default filter
