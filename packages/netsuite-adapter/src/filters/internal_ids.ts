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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, Element, Field, getChangeElement, InstanceElement, isAdditionChange, isInstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import Ajv from 'ajv'
import { logger } from '@salto-io/logging'
import { isDataObjectType } from '../types'
import { FilterCreator } from '../filter'
import NetsuiteClient from '../client/client'

const log = logger(module)
const RECORD_ID_SCHEMA = {
  items: {
    anyOf: [
      {
        properties: {
          id: {
            type: 'string',
          },
          scriptid: {
            type: 'string',
          },
        },
        required: [
          'id',
          'scriptid',
        ],
        type: 'object',
      },
      {
        properties: {
          internalid: {
            type: 'string',
          },
          scriptid: {
            type: 'string',
          },
        },
        required: [
          'internalid',
          'scriptid',
        ],
        type: 'object',
      },
    ],
  },
  type: 'array',
}

type IdRecordIdResult = {
  scriptid: string
  id: string
}
type InternalIdRecordIdResult = {
  scriptid: string
  internalid: string
}

type RecordIdResult = IdRecordIdResult | InternalIdRecordIdResult

const queryRecordIds = async (client: NetsuiteClient, query: string, recordType: string):
Promise<RecordIdResult[]> => {
  const recordIdResults = await client.runSuiteQL(query)
  if (recordIdResults === undefined) {
    return []
  }
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<RecordIdResult[]>(RECORD_ID_SCHEMA, recordIdResults)) {
    log.error(`Got invalid results from listing ${recordType} table: ${ajv.errorsText()}`)
    throw new Error(`Failed to list ${recordType}`)
  }
  return recordIdResults
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
    .forEach(addInternalIdFieldToType)

const formatRecordIdResult = (results: RecordIdResult[]): Record<string, string> =>
  Object.fromEntries(results.map(entry => {
    if ('id' in entry) {
      return [entry.scriptid, entry.id]
    }
    return [entry.scriptid, entry.internalid]
  }))

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
  return formatRecordIdResult(recordTypeIds)
}

const fetchRecordIdsForRecordType = async (
  recordType: string,
  client: NetsuiteClient
): Promise<Record<string, string>> => {
  const internalIdQueryResults = await fetchRecordType('id', client, recordType)
  if (!_.isEmpty(internalIdQueryResults)) {
    return internalIdQueryResults
  }
  return fetchRecordType('internalid', client, recordType)
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
    .filter(async elem => !isDataObjectType(await elem.getType())))


const getAdditionInstances = (changes: Change[]): InstanceElement[] =>
  changes
    .filter(isAdditionChange)
    .map(getChangeElement)
    .filter(isInstanceElement)

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
    const instances = await getListOfSDFInstances(elements)
    const recordIdMap = await createRecordIdsMap(
      client, _.uniq(instances.map(elem => elem.elemID.typeName))
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
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const instances = await getListOfSDFInstances(changes
      .map(getChangeElement))
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
      client, _.uniq(additionInstances.map(instance => instance.elemID.typeName))
    )

    additionInstances
      .filter(instance => recordIdMap[instance.elemID.typeName][instance.value.scriptid])
      .forEach(instance => {
        instance.value.internalId = recordIdMap[instance.elemID.typeName][instance.value.scriptid]
      })
  },
})

export default filterCreator
