/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import Ajv from 'ajv'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { regex } from '@salto-io/lowerdash'
import {
  InstanceElement,
  ObjectType,
  ElemIdGetter,
  OBJECT_SERVICE_ID,
  toServiceIdsString,
  ElemID,
  SaltoElementError,
} from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { CUSTOM_RECORDS_PATH, INTERNAL_ID, NETSUITE, SCRIPT_ID, SOAP_SCRIPT_ID } from '../constants'
import { NetsuiteQuery } from '../config/query'
import NetsuiteClient from '../client/client'
import { RecordValue } from '../client/suiteapp_client/soap_client/types'
import { CustomRecordResult } from '../client/types'

const log = logger(module)

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
  type: string,
): Promise<Record<string, SuiteQLRecord>> => {
  log.debug("querying custom record type '%s' SuiteQL table", type)
  const result = await client.runSuiteQL({ select: 'id, scriptid', from: type, orderBy: 'id' })
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
  query: NetsuiteQuery,
  shouldBeSingleton: boolean,
  elemIdGetter?: ElemIdGetter,
): Promise<{ instances: InstanceElement[]; errors: SaltoElementError[] }> => {
  const idToSuiteQLRecord = records.some(record => !record[SCRIPT_ID])
    ? await queryCustomRecordsTable(client, type.annotations[SCRIPT_ID])
    : {}

  const recordsWithScriptId = records.map(({ [SOAP_SCRIPT_ID]: scriptId, ...record }) => ({
    ...record,
    [SCRIPT_ID]: scriptId
      ? String(scriptId).toLowerCase()
      : idToSuiteQLRecord[record.attributes.internalId]?.scriptid.toLowerCase(),
  }))

  const filteredRecords = recordsWithScriptId.filter(record => {
    if (!record[SCRIPT_ID]) {
      log.warn('Dropping record without %s of type %s: %o', SCRIPT_ID, type.elemID.name, record)
      return false
    }
    return query.isCustomRecordMatch({ type: type.annotations[SCRIPT_ID], instanceId: record[SCRIPT_ID] })
  })

  if (filteredRecords.length === 0) {
    return { instances: [], errors: [] }
  }

  if (shouldBeSingleton && filteredRecords.length === 1) {
    return {
      instances: [
        new InstanceElement(ElemID.CONFIG_NAME, type, filteredRecords[0], [
          NETSUITE,
          CUSTOM_RECORDS_PATH,
          type.elemID.name,
          type.elemID.name,
        ]),
      ],
      errors: [],
    }
  }

  const instances = filteredRecords.map(record => {
    const name =
      elemIdGetter?.(
        NETSUITE,
        {
          [INTERNAL_ID]: record.attributes.internalId,
          [OBJECT_SERVICE_ID]: toServiceIdsString({
            [SCRIPT_ID]: type.annotations[SCRIPT_ID],
          }),
        },
        naclCase(record[SCRIPT_ID]),
      ).name ?? naclCase(record[SCRIPT_ID])

    return new InstanceElement(name, type, record, [
      NETSUITE,
      CUSTOM_RECORDS_PATH,
      type.elemID.name,
      pathNaclCase(name),
    ])
  })

  const errors: SaltoElementError[] = shouldBeSingleton
    ? [
        {
          severity: 'Warning',
          elemID: type.elemID,
          message: 'Fetched multiple instances for a singleton custom record type',
          detailedMessage: `Expected a single instance of type ${type.elemID.name}, but received the following instances instead:
${instances.map(instance => instance.elemID.getFullName()).join('\n')}`,
        },
      ]
    : []

  return { instances, errors }
}

export const getCustomRecords = async (
  client: NetsuiteClient,
  customRecordTypes: ObjectType[],
  query: NetsuiteQuery,
  singletonCustomRecords: string[],
  elemIdGetter?: ElemIdGetter,
): Promise<CustomRecordResult> => {
  if (!client.isSuiteAppConfigured()) {
    return { elements: [], largeTypesError: [], errors: [] }
  }
  const customRecordTypesMap = _.keyBy(customRecordTypes, type => type.annotations[SCRIPT_ID] as string)
  const { customRecords, largeTypesError } = await client.getCustomRecords(
    Object.keys(customRecordTypesMap).filter(query.isCustomRecordTypeMatch),
  )

  const results = await Promise.all(
    customRecords.map(async ({ type, records }) => {
      if (!customRecordTypesMap[type] || records.length === 0) {
        return { type, instances: [], errors: [] }
      }
      const shouldBeSingleton = singletonCustomRecords.some(singletonTypeRegex =>
        regex.isFullRegexMatch(singletonTypeRegex, type),
      )
      return createInstances(client, records, customRecordTypesMap[type], query, shouldBeSingleton, elemIdGetter)
    }),
  )

  return {
    elements: results.flatMap(({ instances }) => instances),
    errors: results.flatMap(({ errors }) => errors),
    largeTypesError,
  }
}
