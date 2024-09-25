/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  CORE_ANNOTATIONS,
  InstanceElement,
  isInstanceElement,
  Element,
  isObjectType,
  ObjectType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import Ajv from 'ajv'
import moment from 'moment-timezone'
import {
  SUITEQL_TABLE,
  getSuiteQLTableInternalIdsMap,
  updateSuiteQLTableInstances,
} from '../../data_elements/suiteql_table_elements'
import NetsuiteClient from '../../client/client'
import { SuiteQLQueryArgs } from '../../client/suiteapp_client/types'
import { RemoteFilterCreator } from '../../filter'
import { getLastServerTime } from '../../server_time'
import {
  EmployeeResult,
  EMPLOYEE_NAME_QUERY,
  EMPLOYEE_SCHEMA,
  SystemNoteResult,
  SYSTEM_NOTE_SCHEMA,
  ModificationInformation,
} from './constants'
import { getInternalId, hasInternalId, isCustomRecordType } from '../../types'
import { CUSTOM_RECORD_TYPE, EMPLOYEE } from '../../constants'
import { toMomentDate } from './saved_searches'
import { toSuiteQLSelectDateString, toSuiteQLWhereDateString } from '../../changes_detector/date_formats'
import { NetsuiteConfig } from '../../config/types'

const { awu } = collections.asynciterable
const log = logger(module)
const UNDERSCORE = '_'
export const FILE_FIELD_IDENTIFIER = 'MEDIAITEM.'
export const FOLDER_FIELD_IDENTIFIER = 'MEDIAITEMFOLDER.'
const FILE_TYPE = 'FILE_TYPE'
const FOLDER_TYPE = 'FOLDER_TYPE'
const ISO_8601 = 'YYYY-MM-DDTHH:mm:ssZ'

const getRecordIdAndTypeStringKey = (recordId: string, recordTypeId: string): string =>
  `${recordId}${UNDERSCORE}${recordTypeId}`

const queryEmployees = async (client: NetsuiteClient): Promise<EmployeeResult[]> => {
  const employeeResults = await client.runSuiteQL(EMPLOYEE_NAME_QUERY)
  if (employeeResults === undefined) {
    return []
  }
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<EmployeeResult[]>(EMPLOYEE_SCHEMA, employeeResults)) {
    log.error(`Got invalid results from listing employees table: ${ajv.errorsText()}`)
    return []
  }
  return employeeResults
}

const toDateQuery = (lastFetchTime: Date): string => `date >= ${toSuiteQLWhereDateString(lastFetchTime)}`

// File and folder types have system notes without record type ids,
// But they have a prefix in the field column.
const toFieldWhereQuery = (recordType: string): string =>
  recordType === FILE_TYPE ? `field LIKE '${FILE_FIELD_IDENTIFIER}%'` : `field LIKE '${FOLDER_FIELD_IDENTIFIER}%'`

const buildRecordTypeSystemNotesQuery = (recordTypeIds: string[], lastFetchTime: Date): SuiteQLQueryArgs => ({
  select: 'name, recordid, recordtypeid, date',
  from:
    `(SELECT name, recordid, recordtypeid, ${toSuiteQLSelectDateString('MAX(date)')} as date` +
    ` FROM systemnote WHERE ${toDateQuery(lastFetchTime)} AND recordtypeid IN (${recordTypeIds.join(', ')})` +
    ' GROUP BY name, recordid, recordtypeid)',
  orderBy: 'name, recordid, recordtypeid',
})

const buildFieldSystemNotesQuery = (fieldIds: string[], lastFetchTime: Date): SuiteQLQueryArgs => ({
  select: `name, field, recordid, ${toSuiteQLSelectDateString('MAX(date)')} AS date`,
  from: 'systemnote',
  where: `${toDateQuery(lastFetchTime)} AND (${fieldIds.map(toFieldWhereQuery).join(' OR ')})`,
  groupBy: 'name, field, recordid',
  orderBy: 'name, field, recordid',
})

const querySystemNotesByField = async (
  client: NetsuiteClient,
  queryIds: string[],
  lastFetchTime: Date,
): Promise<Record<string, unknown>[]> =>
  queryIds.length > 0 ? (await client.runSuiteQL(buildFieldSystemNotesQuery(queryIds, lastFetchTime))) ?? [] : []

const querySystemNotesByRecordType = async (
  client: NetsuiteClient,
  queryIds: string[],
  lastFetchTime: Date,
): Promise<Record<string, unknown>[]> =>
  queryIds.length > 0 ? (await client.runSuiteQL(buildRecordTypeSystemNotesQuery(queryIds, lastFetchTime))) ?? [] : []

const querySystemNotes = async (
  client: NetsuiteClient,
  queryIds: string[],
  lastFetchTime: Date,
): Promise<SystemNoteResult[]> => {
  const [fieldQueryIds, recordTypeQueryIds] = _.partition(queryIds, id => [FILE_TYPE, FOLDER_TYPE].includes(id))

  const systemNoteResults = (
    await Promise.all([
      querySystemNotesByField(client, fieldQueryIds, lastFetchTime),
      querySystemNotesByRecordType(client, recordTypeQueryIds, lastFetchTime),
    ])
  ).flat()

  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<SystemNoteResult[]>(SYSTEM_NOTE_SCHEMA, systemNoteResults)) {
    log.error(`Got invalid results from system note table: ${ajv.errorsText()}`)
    return []
  }
  log.debug('queried %d new system notes since last fetch (%s)', systemNoteResults.length, lastFetchTime.toUTCString())
  return systemNoteResults
}

const fetchEmployeeNames = async (client: NetsuiteClient): Promise<Record<string, string>> => {
  const employees = await queryEmployees(client)
  if (!_.isEmpty(employees)) {
    return Object.fromEntries(employees.map(entry => [entry.id, entry.entityid]))
  }
  return {}
}

const getKeyForNote = (systemNote: SystemNoteResult): string => {
  if ('recordtypeid' in systemNote) {
    return getRecordIdAndTypeStringKey(systemNote.recordid, systemNote.recordtypeid)
  }
  return systemNote.field === FOLDER_FIELD_IDENTIFIER
    ? getRecordIdAndTypeStringKey(systemNote.recordid, FOLDER_TYPE)
    : getRecordIdAndTypeStringKey(systemNote.recordid, FILE_TYPE)
}

const distinctSortedSystemNotes = (systemNotes: SystemNoteResult[]): SystemNoteResult[] =>
  _(systemNotes)
    .sortBy(note => note.date)
    .reverse()
    .uniqBy(note => getKeyForNote(note))
    .value()

const indexSystemNotes = (systemNotes: SystemNoteResult[]): Record<string, ModificationInformation> =>
  Object.fromEntries(
    systemNotes.map(systemnote => [
      getKeyForNote(systemnote),
      { lastModifiedBy: systemnote.name, lastModifiedAt: systemnote.date },
    ]),
  )

const getEmployeeInternalIdsMap = async (
  client: NetsuiteClient,
  config: NetsuiteConfig,
  employeeSuiteQLTableInstance: InstanceElement | undefined,
  systemNotes: SystemNoteResult[],
): Promise<Record<string, string>> => {
  if (employeeSuiteQLTableInstance === undefined) {
    return fetchEmployeeNames(client)
  }
  const existingEmployeeInternalIdsMap = getSuiteQLTableInternalIdsMap(employeeSuiteQLTableInstance)
  const employeeInternalIdsToQuery = systemNotes
    .map(row => row.name)
    .filter(name => existingEmployeeInternalIdsMap[name] === undefined)
    .map(internalId => ({ tableName: EMPLOYEE, item: internalId }))

  await updateSuiteQLTableInstances({
    client,
    config,
    queryBy: 'internalId',
    itemsToQuery: employeeInternalIdsToQuery,
    suiteQLTablesMap: {
      [EMPLOYEE]: employeeSuiteQLTableInstance,
    },
  })

  return _.mapValues(getSuiteQLTableInternalIdsMap(employeeSuiteQLTableInstance), row => row.name)
}

const fetchSystemNotes = async (
  client: NetsuiteClient,
  config: NetsuiteConfig,
  queryIds: string[],
  lastFetchTime: Date,
  employeeSuiteQLTableInstance: InstanceElement | undefined,
  timeZone: string | undefined,
): Promise<Record<string, ModificationInformation>> => {
  const now = timeZone ? moment.tz(timeZone).utc() : moment().utc()
  const systemNotes = await log.timeDebug(() => querySystemNotes(client, queryIds, lastFetchTime), 'querySystemNotes')
  const employeeNames = await getEmployeeInternalIdsMap(client, config, employeeSuiteQLTableInstance, systemNotes)
  return indexSystemNotes(
    distinctSortedSystemNotes(
      systemNotes
        .map(({ date, name, ...item }) => ({
          ...item,
          name: employeeNames[name],
          dateString: date,
          date: toMomentDate(date, { format: ISO_8601, timeZone }),
        }))
        .filter(({ date, dateString, name }) => {
          if (!date.isValid()) {
            log.warn('dropping invalid date: %s', dateString)
            return false
          }
          if (now.isBefore(date)) {
            log.warn('dropping future date: %s > %s (now)', date.format(), now.format())
            return false
          }
          return name !== undefined
        })
        .map(({ date, ...item }) => ({
          ...item,
          date: date.format(),
        })),
    ),
  )
}

const getInstancesWithInternalIds = (
  elements: Element[],
  typeToInternalId: Record<string, string>,
): InstanceElement[] =>
  elements
    .filter(isInstanceElement)
    .filter(hasInternalId)
    .filter(instance => instance.elemID.typeName.toLowerCase() in typeToInternalId)

const getCustomRecordTypesWithInternalIds = (elements: Element[]): ObjectType[] =>
  elements.filter(isObjectType).filter(isCustomRecordType).filter(hasInternalId)

const getCustomRecordsWithInternalIds = (elements: Element[]): Promise<InstanceElement[]> =>
  awu(elements)
    .filter(isInstanceElement)
    .filter(hasInternalId)
    .filter(async instance => isCustomRecordType(await instance.getType()))
    .toArray()

const filterCreator: RemoteFilterCreator = ({
  client,
  config,
  typeToInternalId: originalTypeToInternalId,
  elementsSource,
  elementsSourceIndex,
  timeZoneAndFormat,
}) => ({
  name: 'systemNoteAuthorInformation',
  remote: true,
  onFetch: async elements => {
    // if undefined, we want to be treated as true so we check `=== false`
    if (config.fetch.authorInformation?.enable === false) {
      log.debug('Author information fetching is disabled')
      return
    }
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const lastFetchTime = await getLastServerTime(elementsSource)
    if (lastFetchTime === undefined) {
      // in order to reduce the fetch duration we want to query author information
      // only since last fetch, and not querying at all on the first fetch
      log.debug('skipping author information fetching on first fetch')
      return
    }

    const typeToInternalId = _.mapKeys(
      {
        ...originalTypeToInternalId,
        // Types without record type id that are given new ids.
        file: FILE_TYPE,
        folder: FOLDER_TYPE,
      },
      (_value, key) => key.toLowerCase(),
    )

    const instancesWithInternalId = getInstancesWithInternalIds(elements, typeToInternalId)
    const customRecordTypesWithInternalIds = getCustomRecordTypesWithInternalIds(elements)
    const customRecordsWithInternalIds = await getCustomRecordsWithInternalIds(elements)
    const customRecordTypeNames = new Set(customRecordsWithInternalIds.map(({ elemID }) => elemID.typeName))

    const queryIds = _.uniq(
      instancesWithInternalId.map(instance => typeToInternalId[instance.elemID.typeName.toLowerCase()]),
    )
    if (customRecordTypesWithInternalIds.length > 0) {
      queryIds.push(
        ...customRecordTypesWithInternalIds
          .filter(({ elemID }) => customRecordTypeNames.has(elemID.name))
          .map(getInternalId)
          .concat(typeToInternalId[CUSTOM_RECORD_TYPE]),
      )
    }

    if (_.isEmpty(queryIds)) {
      return
    }

    const employeeSuiteQLTableInstance = elements
      .filter(isInstanceElement)
      .find(instance => instance.elemID.typeName === SUITEQL_TABLE && instance.elemID.name === EMPLOYEE)

    const timeZone = timeZoneAndFormat?.timeZone
    const systemNotes = await fetchSystemNotes(
      client,
      config,
      queryIds,
      lastFetchTime,
      employeeSuiteQLTableInstance,
      timeZone,
    )
    const { elemIdToChangeByIndex, elemIdToChangeAtIndex } = await elementsSourceIndex.getIndexes()
    if (_.isEmpty(systemNotes) && _.isEmpty(elemIdToChangeByIndex) && _.isEmpty(elemIdToChangeAtIndex)) {
      return
    }

    const setAuthorInformation = (element: Element, info: ModificationInformation | undefined): void => {
      if (info !== undefined) {
        element.annotate({ [CORE_ANNOTATIONS.CHANGED_BY]: info.lastModifiedBy })
        element.annotate({ [CORE_ANNOTATIONS.CHANGED_AT]: info.lastModifiedAt })
      } else {
        element.annotate({ [CORE_ANNOTATIONS.CHANGED_BY]: elemIdToChangeByIndex[element.elemID.getFullName()] })
        element.annotate({ [CORE_ANNOTATIONS.CHANGED_AT]: elemIdToChangeAtIndex[element.elemID.getFullName()] })
      }
    }

    instancesWithInternalId.forEach(instance => {
      const info =
        systemNotes[
          getRecordIdAndTypeStringKey(
            instance.value.internalId,
            typeToInternalId[instance.elemID.typeName.toLowerCase()],
          )
        ]
      setAuthorInformation(instance, info)
    })
    customRecordTypesWithInternalIds.forEach(type => {
      const info =
        systemNotes[getRecordIdAndTypeStringKey(type.annotations.internalId, typeToInternalId[CUSTOM_RECORD_TYPE])]
      setAuthorInformation(type, info)
    })
    await awu(customRecordsWithInternalIds).forEach(async instance => {
      const info =
        systemNotes[getRecordIdAndTypeStringKey(getInternalId(instance), getInternalId(await instance.getType()))]
      setAuthorInformation(instance, info)
    })
  },
})

export default filterCreator
