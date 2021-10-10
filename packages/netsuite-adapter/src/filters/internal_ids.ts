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
import { BuiltinTypes, CORE_ANNOTATIONS, Element, Field, getChangeElement, InstanceElement, isInstanceElement, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { isDataObjectType } from '../types'
import { FilterCreator } from '../filter'
import NetsuiteClient from '../client/client'

const addInternalIdFieldToType = (object: ObjectType): void => {
  object.fields.internalId = new Field(
    object,
    'internalId',
    BuiltinTypes.STRING,
    { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
  )
}

const addInternalIdFieldToInstancesObjects = async (
  instances: InstanceElement[]
): Promise<void> => {
  _.uniq(
    await Promise.all(
      instances.map(async instance => instance.getType())
    )
  ).forEach(addInternalIdFieldToType)
}

const fetchRecordIdsForRecordType = async (
  recordType: string,
  client: NetsuiteClient
): Promise<Record<string, string>> => {
  const fetchRecordType = async (idParamName: string): Promise<Record<string, string>> => {
    const recordTypeIds = await client.runSuiteQL(`SELECT scriptid, ${idParamName} FROM ${recordType}`)
    if (recordTypeIds) {
      return Object.fromEntries(recordTypeIds.map(entry => [entry.scriptid, entry[idParamName]]))
    }
    return {}
  }
  const internalIdQueryResults = await fetchRecordType('internalid')
  if (!_.isEmpty(internalIdQueryResults)) {
    return internalIdQueryResults
  }
  return fetchRecordType('id')
}

const createRecordIdsMap = async (
  client: NetsuiteClient,
  recordTypes: string[]
): Promise<Record<string, Record<string, string>>> =>
  Object.fromEntries(
    await Promise.all(recordTypes
      .map(async recordType =>
        [recordType, await fetchRecordIdsForRecordType(recordType, client)]))
  )


const getListOfSDFInstances = async (elements: Element[]): Promise<InstanceElement[]> =>
  Promise.all(elements
    .filter(isInstanceElement)
    .filter(elem => elem.value.scriptid)
    .filter(async a => !isDataObjectType(await a.getType())))

/**
 * This filter adds the internal id to instances.
 * so we will be able to reference them in other instances
 * that are returned from SOAP API (e.g., Employee)
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async elements => {
    const instances = await getListOfSDFInstances(elements)
    await addInternalIdFieldToInstancesObjects(instances)
    const recordIdMap = await createRecordIdsMap(
      client, instances.map(elem => elem.elemID.typeName)
    )
    instances
      .filter(instance => recordIdMap[instance.elemID.typeName][instance.value.scriptid])
      .forEach(instance => {
        instance.value.internalId = recordIdMap[instance.elemID.typeName][instance.value.scriptid]
      })
  },

  /**
   * This removes the internal id before deploy since we don't want to actually deploy it to SDF
   */
  preDeploy: async changes => {
    const instances = await getListOfSDFInstances(changes
      .map(getChangeElement))
    instances.forEach(element => {
      delete element.value.internalId
    })
  },
})

export default filterCreator
