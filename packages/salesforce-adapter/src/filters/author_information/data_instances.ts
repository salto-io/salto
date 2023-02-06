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
import { CORE_ANNOTATIONS, Element, InstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isInstanceOfCustomObject } from '../../transformers/transformer'
import { FilterWith, RemoteFilterCreator } from '../../filter'
import SalesforceClient from '../../client/client'
import { conditionQueries, ensureSafeFilterFetch, queryClient } from '../utils'

const { awu } = collections.asynciterable
const GET_ID_AND_NAMES_OF_USERS_QUERY = 'SELECT Id,Name FROM User'

const getIDToNameMap = async (client: SalesforceClient,
  instances: InstanceElement[]): Promise<Record<string, string>> => {
  const instancesIDs = Array.from(new Set(
    instances.flatMap(instance => [instance.value.CreatedById, instance.value.LastModifiedById])
  ))
  const queries = conditionQueries(GET_ID_AND_NAMES_OF_USERS_QUERY,
    instancesIDs.map(id => ({ Id: `'${id}'` })))
  const records = await queryClient(client, queries)
  return Object.fromEntries(records.map(record => [record.Id, record.Name]))
}

const moveAuthorFieldsToAnnotations = (
  instance: InstanceElement,
  IDToNameMap: Record<string, string>
): void => {
  instance.annotations[CORE_ANNOTATIONS.CREATED_AT] = instance.value.CreatedDate
  instance.annotations[CORE_ANNOTATIONS.CREATED_BY] = IDToNameMap[instance.value.CreatedById]
  instance.annotations[CORE_ANNOTATIONS.CHANGED_AT] = instance.value.LastModifiedDate
  instance.annotations[CORE_ANNOTATIONS.CHANGED_BY] = IDToNameMap[
    instance.value.LastModifiedById]
}

const moveInstancesAuthorFieldsToAnnotations = (
  instances: InstanceElement[],
  IDToNameMap: Record<string, string>
): void => {
  instances.forEach(instance => moveAuthorFieldsToAnnotations(instance, IDToNameMap))
}

export const WARNING_MESSAGE = 'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.'

/*
 * add author information to data instance elements.
 */
const filterCreator: RemoteFilterCreator = ({ client, config }): FilterWith<'onFetch'> => ({
  name: 'dataInstancesAuthorFilter',
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    filterName: 'authorInformation',
    fetchFilterFunc: async (elements: Element[]) => {
      const customObjectInstances = await awu(elements).filter(isInstanceOfCustomObject)
        .toArray() as InstanceElement[]
      const IDToNameMap = await getIDToNameMap(client, customObjectInstances)
      moveInstancesAuthorFieldsToAnnotations(customObjectInstances, IDToNameMap)
    },
  }),
})

export default filterCreator
