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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, Element, Field, getChangeData, InstanceElement, isAdditionChange, isInstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import Ajv from 'ajv'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { RECORD_ID_SCHEMA, TABLE_NAME_TO_ID_PARAMETER_MAP } from './constants'
import NetsuiteClient from '../../client/client'

const log = logger(module)

type RecordIdResult = {
  scriptid: string
  id: string
}

type QueryResponse = {
  scriptid: string
} & ({
  id: string
 } | {
  internalid: string
 })

const CUSTOM_FIELD = 'customfield'

const TYPE_NAMES_TO_TABLE_NAME: Record<string, string> = {
  entitycustomfield: CUSTOM_FIELD,
  transactionbodycustomfield: CUSTOM_FIELD,
  itemcustomfield: CUSTOM_FIELD,
  crmcustomfield: CUSTOM_FIELD,
  itemnumbercustomfield: CUSTOM_FIELD,
  itemoptioncustomfield: CUSTOM_FIELD,
  transactioncolumncustomfield: CUSTOM_FIELD,
  othercustomfield: CUSTOM_FIELD,
  sspapplication: 'webapp',
  sdfinstallationscript: 'script',
}

const getTableName = (element: Element): string => {
  if (element.elemID.typeName in TYPE_NAMES_TO_TABLE_NAME) {
    return TYPE_NAMES_TO_TABLE_NAME[element.elemID.typeName]
  }
  return element.elemID.typeName
}

const queryRecordIds = async (client: NetsuiteClient, query: string, recordType: string):
Promise<RecordIdResult[]> => {
  const recordIdResults = await client.runSuiteQL(query)
  if (recordIdResults === undefined) {
    return []
  }
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<QueryResponse[]>(RECORD_ID_SCHEMA, recordIdResults)) {
    log.error(`Got invalid results from listing ${recordType} table: ${ajv.errorsText()}`)
    return []
  }
  return recordIdResults.map(res => ({
    scriptid: res.scriptid,
    id: 'id' in res ? res.id : res.internalid,
  }))
}

const addInternalIdFieldToType = (object: ObjectType): void => {
  if (_.isUndefined(object.fields.internalId)) {
    object.fields.internalId = new Field(
      object,
      'internalId',
      BuiltinTypes.STRING,
      { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
    )
  }
}

const addInternalIdFieldToInstancesObjects = async (
  elements: Element[]
): Promise<void> =>
  elements
    .filter(isObjectType)
    .filter(object => getTableName(object) in TABLE_NAME_TO_ID_PARAMETER_MAP)
    .forEach(addInternalIdFieldToType)

const fetchRecordType = async (
  idParamName: string,
  client: NetsuiteClient,
  recordType: string,
): Promise<Record<string, string>> => {
  const query = `SELECT scriptid, ${idParamName} FROM ${recordType} ORDER BY ${idParamName} ASC`
  const recordTypeIds = await queryRecordIds(client, query, recordType)
  if (_.isUndefined(recordTypeIds) || _.isEmpty(recordTypeIds)) {
    return {}
  }
  // SDF returns script ids as lowercase even if they are in upper case in the service.
  return Object.fromEntries(recordTypeIds.map(entry => [entry.scriptid.toLowerCase(), entry.id]))
}

const fetchRecordIdsForRecordType = async (
  recordType: string,
  client: NetsuiteClient
): Promise<Record<string, string>> =>
  fetchRecordType(TABLE_NAME_TO_ID_PARAMETER_MAP[recordType], client, recordType)

const createRecordIdsMap = async (
  client: NetsuiteClient,
  recordTypes: string[]
): Promise<Record<string, Record<string, string>>> =>
  Object.fromEntries(
    await Promise.all(recordTypes
      .map(async recordType =>
        [recordType, await fetchRecordIdsForRecordType(recordType, client)]))
  )


const getSupportedInstances = (elements: Element[]): InstanceElement[] =>
  elements
    .filter(isInstanceElement)
    .filter(elem => getTableName(elem) in TABLE_NAME_TO_ID_PARAMETER_MAP)


const getAdditionInstances = (changes: Change[]): InstanceElement[] =>
  getSupportedInstances(changes
    .filter(isAdditionChange)
    .map(getChangeData))

/**
 * This filter adds the internal id to instances.
 * so we will be able to reference them in other instances
 * that are returned from SOAP API (e.g., Employee)
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async elements => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    await addInternalIdFieldToInstancesObjects(elements)
    const instances = getSupportedInstances(elements)
    const recordIdMap = await createRecordIdsMap(
      client, _.uniq(instances.map(getTableName))
    )
    instances
      .filter(instance => recordIdMap[
        getTableName(instance)][instance.value.scriptid.toLowerCase()])
      .forEach(instance => {
        instance.value.internalId = recordIdMap[
          getTableName(instance)][instance.value.scriptid.toLowerCase()]
      })
  },

  /**
   * This removes the internal id before deploy since we don't want to actually deploy it to SDF
   */
  preDeploy: async changes => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const instances = getSupportedInstances(changes
      .map(getChangeData))
    instances.forEach(element => {
      delete element.value.internalId
    })
  },
  /**
   * This assign the internal id for new instances created through Salto
   */
  onDeploy: async changes => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const additionInstances = getAdditionInstances(changes)
    if (additionInstances.length === 0) {
      return
    }
    const recordIdMap = await createRecordIdsMap(
      client, _.uniq(additionInstances.map(instance => getTableName(instance)))
    )

    additionInstances
      .filter(instance => recordIdMap[
        getTableName(instance)][instance.value.scriptid.toLowerCase()])
      .forEach(instance => {
        instance.value.internalId = recordIdMap[
          getTableName(instance)][instance.value.scriptid.toLowerCase()]
      })
  },
})

export default filterCreator
