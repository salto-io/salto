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
import Ajv from 'ajv'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { InstanceElement, ObjectType, ElemIdGetter, OBJECT_SERVICE_ID, toServiceIdsString, OBJECT_NAME } from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { CUSTOM_RECORDS_PATH, NETSUITE, SCRIPT_ID, SOAP_SCRIPT_ID } from '../constants'
import { NetsuiteQuery } from '../query'
import NetsuiteClient from '../client/client'
import { RecordValue } from '../client/suiteapp_client/soap_client/types'

const log = logger(module)
const { awu } = collections.asynciterable

type SuiteQLRecord = {
  id: string
  scriptid: string
}

const SUITE_QL_RESULTS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      scriptid: { type: 'string' },
    },
    required: ['id', 'scriptid'],
  },
}

const queryCustomRecordsTable = async (
  client: NetsuiteClient,
  type: string
): Promise<Record<string, SuiteQLRecord>> => {
  log.debug('querying custom record type \'%s\' SuiteQL table', type)
  const result = await client.runSuiteQL(`SELECT id, scriptid FROM ${type} ORDER BY id ASC`)
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<SuiteQLRecord[]>(SUITE_QL_RESULTS_SCHEMA, result)) {
    log.error(`Got invalid results from listing ${type} table: ${ajv.errorsText()}`)
    return {}
  }
  return _.keyBy(result, record => record.id)
}

const createInstances = async (
  client: NetsuiteClient,
  records: RecordValue[],
  type: ObjectType,
  elemIdGetter?: ElemIdGetter,
): Promise<InstanceElement[]> => {
  const idToSuiteQLRecord = records.some(record => !record[SCRIPT_ID])
    ? await queryCustomRecordsTable(client, type.annotations[SCRIPT_ID])
    : {}

  return records.map(record => ({
    [SCRIPT_ID]: record[SOAP_SCRIPT_ID]
      ? String(record[SOAP_SCRIPT_ID]).toLowerCase()
      : idToSuiteQLRecord[record.attributes.internalId]?.scriptid.toLowerCase(),
    ..._.omit(record, SOAP_SCRIPT_ID),
  })).filter(record => {
    if (!record[SCRIPT_ID]) {
      log.warn('Dropping record without %s of type %s: %o', SCRIPT_ID, type.elemID.name, record)
      return false
    }
    return true
  }).map(record => ({
    name: elemIdGetter?.(NETSUITE, {
      [SCRIPT_ID]: record[SCRIPT_ID],
      [OBJECT_SERVICE_ID]: toServiceIdsString({
        [OBJECT_NAME]: type.elemID.getFullName(),
      }),
    }, naclCase(record[SCRIPT_ID])).name ?? naclCase(record[SCRIPT_ID]),
    record,
  })).map(({ name, record }) => new InstanceElement(
    name,
    type,
    record,
    [NETSUITE, CUSTOM_RECORDS_PATH, type.elemID.name, pathNaclCase(name)],
  ))
}

export const getCustomRecords = async (
  client: NetsuiteClient,
  customRecordTypes: ObjectType[],
  query: NetsuiteQuery,
  elemIdGetter?: ElemIdGetter,
): Promise<InstanceElement[]> => {
  if (!client.isSuiteAppConfigured()) {
    return []
  }
  const customRecordTypesMap = _.keyBy(
    customRecordTypes,
    type => type.annotations[SCRIPT_ID] as string
  )
  const customRecords = await client.getCustomRecords(
    Object.keys(customRecordTypesMap).filter(query.isCustomRecordTypeMatch)
  )

  const results = await awu(customRecords).map(async ({ type, records }) => (
    !customRecordTypesMap[type] || records.length === 0 ? {
      type,
      instances: [],
    } : {
      type,
      instances: await createInstances(client, records, customRecordTypesMap[type], elemIdGetter),
    }
  )).toArray()

  return results.flatMap(({ type, instances }) => instances.filter(
    instance => query.isCustomRecordMatch({ type, instanceId: instance.value[SCRIPT_ID] })
  ))
}
