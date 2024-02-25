/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { TYPES_TO_INTERNAL_ID as ORIGINAL_TYPES_TO_INTERNAL_ID } from '../../data_elements/types'
import { SUITEQL_TABLE, getSuiteQLTableInternalIdsMap } from '../../data_elements/suiteql_table_elements'
import NetsuiteClient from '../../client/client'
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

const { awu } = collections.asynciterable
const log = logger(module)
const UNDERSCORE = '_'
export const FILE_FIELD_IDENTIFIER = 'MEDIAITEM.'
export const FOLDER_FIELD_IDENTIFIER = 'MEDIAITEMFOLDER.'
const FILE_TYPE = 'FILE_TYPE'
const FOLDER_TYPE = 'FOLDER_TYPE'
const ISO_8601 = 'YYYY-MM-DDTHH:mm:ssZ'

const TYPES_TO_INTERNAL_ID: Record<string, string> = _.mapKeys(
  {
    ...ORIGINAL_TYPES_TO_INTERNAL_ID,
    // Types without record type id that are given new ids.
    file: FILE_TYPE,
    folder: FOLDER_TYPE,
  },
  (_value, key) => key.toLowerCase(),
)

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

const buildRecordTypeSystemNotesQuery = (recordTypeIds: string[], lastFetchTime: Date): string => {
  const recordTypeMatchClause = `recordtypeid IN (${recordTypeIds.join(', ')})`
  return (
    'SELECT name, recordid, recordtypeid, date FROM (SELECT name, recordid, recordtypeid,' +
    ` ${toSuiteQLSelectDateString('MAX(date)')} as date FROM systemnote WHERE ${toDateQuery(lastFetchTime)} AND ${recordTypeMatchClause}` +
    ' GROUP BY name, recordid, recordtypeid) ORDER BY name, recordid, recordtypeid ASC'
  )
}

const buildFieldSystemNotesQuery = (fieldIds: string[], lastFetchTime: Date): string => {
  const whereQuery = fieldIds.map(toFieldWhereQuery).join(' OR ')
  return (
    `SELECT name, field, recordid, ${toSuiteQLSelectDateString('MAX(date)')} AS date` +
    ` FROM systemnote WHERE ${toDateQuery(lastFetchTime)} AND (${whereQuery})` +
    ' GROUP BY name, field, recordid' +
    ' ORDER BY name, field, recordid ASC'
  )
}

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

const getEmployeeNamesFromEmployeeSuiteQLTableInstance = (instance: InstanceElement): Record<string, string> => {
  const internalIdsMap = getSuiteQLTableInternalIdsMap(instance)
  return _.mapValues(internalIdsMap, row => row.name)
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

const fetchSystemNotes = async (
  client: NetsuiteClient,
  queryIds: string[],
  lastFetchTime: Date,
  employeeNames: Record<string, string>,
  timeZone: string | undefined,
): Promise<Record<string, ModificationInformation>> => {
  const systemNotes = await log.time(() => querySystemNotes(client, queryIds, lastFetchTime), 'querySystemNotes')
  if (_.isEmpty(systemNotes)) {
    log.warn('System note query failed')
    return {}
  }
  const now = timeZone ? moment.tz(timeZone).utc() : moment().utc()
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

const getInstancesWithInternalIds = (elements: Element[]): InstanceElement[] =>
  elements
    .filter(isInstanceElement)
    .filter(hasInternalId)
    .filter(instance => instance.elemID.typeName.toLowerCase() in TYPES_TO_INTERNAL_ID)

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
    const instancesWithInternalId = getInstancesWithInternalIds(elements)
    const customRecordTypesWithInternalIds = getCustomRecordTypesWithInternalIds(elements)
    const customRecordsWithInternalIds = await getCustomRecordsWithInternalIds(elements)
    const customRecordTypeNames = new Set(customRecordsWithInternalIds.map(({ elemID }) => elemID.typeName))

    const queryIds = _.uniq(
      instancesWithInternalId.map(instance => TYPES_TO_INTERNAL_ID[instance.elemID.typeName.toLowerCase()]),
    )
    if (customRecordTypesWithInternalIds.length > 0) {
      queryIds.push(
        ...customRecordTypesWithInternalIds
          .filter(({ elemID }) => customRecordTypeNames.has(elemID.name))
          .map(getInternalId)
          .concat(TYPES_TO_INTERNAL_ID[CUSTOM_RECORD_TYPE]),
      )
    }

    if (_.isEmpty(queryIds)) {
      return
    }

    const employeeSuiteQLTableInstance = elements
      .filter(isInstanceElement)
      .find(instance => instance.elemID.typeName === SUITEQL_TABLE && instance.elemID.name === EMPLOYEE)
    const employeeNames =
      employeeSuiteQLTableInstance !== undefined
        ? getEmployeeNamesFromEmployeeSuiteQLTableInstance(employeeSuiteQLTableInstance)
        : await fetchEmployeeNames(client)

    const timeZone = timeZoneAndFormat?.timeZone
    const systemNotes = !_.isEmpty(employeeNames)
      ? await fetchSystemNotes(client, queryIds, lastFetchTime, employeeNames, timeZone)
      : {}
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
            TYPES_TO_INTERNAL_ID[instance.elemID.typeName.toLowerCase()],
          )
        ]
      setAuthorInformation(instance, info)
    })
    customRecordTypesWithInternalIds.forEach(type => {
      const info =
        systemNotes[getRecordIdAndTypeStringKey(type.annotations.internalId, TYPES_TO_INTERNAL_ID[CUSTOM_RECORD_TYPE])]
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
