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

import { CORE_ANNOTATIONS, InstanceElement, isInstanceElement, Element, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { values as lowerDashValues, collections } from '@salto-io/lowerdash'
import Ajv from 'ajv'
import moment from 'moment-timezone'
import { TYPES_TO_INTERNAL_ID as ORIGINAL_TYPES_TO_INTERNAL_ID } from '../../data_elements/types'
import NetsuiteClient from '../../client/client'
import { FilterCreator, FilterWith } from '../../filter'
import { getLastServerTime } from '../../server_time'
import { EmployeeResult, EMPLOYEE_NAME_QUERY, EMPLOYEE_SCHEMA, SystemNoteResult, SYSTEM_NOTE_SCHEMA, ModificationInformation } from './constants'
import { getInternalId, hasInternalId, isCustomRecordType } from '../../types'
import { CUSTOM_RECORD_TYPE } from '../../constants'
import { changeDateFormat, getZoneAndFormat } from './saved_searches'

const { isDefined } = lowerDashValues
const { awu } = collections.asynciterable
const log = logger(module)
const UNDERSCORE = '_'
export const FILE_FIELD_IDENTIFIER = 'MEDIAITEM.'
export const FOLDER_FIELD_IDENTIFIER = 'MEDIAITEMFOLDER.'
export const QUERY_DATE_FORMAT = 'YYYY-MM-DD HH:MI:SS'
const FILE_TYPE = 'FILE_TYPE'
const FOLDER_TYPE = 'FOLDER_TYPE'

const TYPES_TO_INTERNAL_ID: Record<string, string> = _.mapKeys({
  ...ORIGINAL_TYPES_TO_INTERNAL_ID,
  // Types without record type id that are given new ids.
  file: FILE_TYPE,
  folder: FOLDER_TYPE,
}, (_value, key) => key.toLowerCase())

const toDateString = (date: Date): string => date.toISOString().slice(0, 10)

const getRecordIdAndTypeStringKey = (recordId: string, recordTypeId: string): string =>
  `${recordId}${UNDERSCORE}${recordTypeId}`

const queryEmployees = async (client: NetsuiteClient):
Promise<EmployeeResult[]> => {
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

const toDateQuery = (lastFetchTime: Date): string =>
  `date >= TO_DATE('${toDateString(lastFetchTime)}', '${QUERY_DATE_FORMAT}')`

const toRecordTypeWhereQuery = (recordType: string): string =>
  `recordtypeid = '${recordType}'`

// File and folder types have system notes without record type ids,
// But they have a prefix in the field column.
const toFieldWhereQuery = (recordType: string): string => (
  recordType === FILE_TYPE
    ? `field LIKE '${FILE_FIELD_IDENTIFIER}%'`
    : `field LIKE '${FOLDER_FIELD_IDENTIFIER}%'`
)

const buildRecordTypeSystemNotesQuery = (
  recordTypeIds: string[],
  lastFetchTime: Date
): string => {
  const whereQuery = recordTypeIds
    .map(toRecordTypeWhereQuery)
    .join(' OR ')
  return 'SELECT name, recordid, recordtypeid, date FROM (SELECT name, recordid, recordtypeid,'
    + ` TO_CHAR(MAX(date), '${QUERY_DATE_FORMAT}') as date FROM systemnote WHERE ${toDateQuery(lastFetchTime)} AND (${whereQuery})`
    + ' GROUP BY name, recordid, recordtypeid) ORDER BY name, recordid, recordtypeid ASC'
}

const buildFieldSystemNotesQuery = (
  fieldIds: string[],
  lastFetchTime: Date
): string => {
  const whereQuery = fieldIds
    .map(toFieldWhereQuery)
    .join(' OR ')
  return `SELECT name, field, recordid, date from (SELECT name, field, recordid, TO_CHAR(MAX(date), '${QUERY_DATE_FORMAT}') AS date`
    + ` FROM (SELECT name, REGEXP_SUBSTR(field, '^(${FOLDER_FIELD_IDENTIFIER}|${FILE_FIELD_IDENTIFIER})')`
    + ` AS field, recordid, date FROM systemnote WHERE ${toDateQuery(lastFetchTime)} AND (${whereQuery}))`
    + ' GROUP BY name, field, recordid) ORDER BY name, field, recordid ASC'
}

const querySystemNotesByField = async (
  client: NetsuiteClient,
  queryIds: string[],
  lastFetchTime: Date
): Promise<Record<string, unknown>[]> => (
  queryIds.length > 0
    ? await client.runSuiteQL(buildFieldSystemNotesQuery(queryIds, lastFetchTime)) ?? []
    : []
)

const querySystemNotesByRecordType = async (
  client: NetsuiteClient,
  queryIds: string[],
  lastFetchTime: Date
): Promise<Record<string, unknown>[]> => (
  queryIds.length > 0
    ? await client.runSuiteQL(buildRecordTypeSystemNotesQuery(queryIds, lastFetchTime)) ?? []
    : []
)

const querySystemNotes = async (
  client: NetsuiteClient,
  queryIds: string[],
  lastFetchTime: Date
): Promise<SystemNoteResult[]> => {
  const [fieldQueryIds, recordTypeQueryIds] = _.partition(
    queryIds, id => [FILE_TYPE, FOLDER_TYPE].includes(id)
  )

  const systemNoteResults = (await Promise.all([
    querySystemNotesByField(client, fieldQueryIds, lastFetchTime),
    querySystemNotesByRecordType(client, recordTypeQueryIds, lastFetchTime),
  ])).flat()

  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<SystemNoteResult[]>(SYSTEM_NOTE_SCHEMA, systemNoteResults)) {
    log.error(`Got invalid results from system note table: ${ajv.errorsText()}`)
    return []
  }
  log.debug(
    'queried %d new system notes since last fetch (%s)',
    systemNoteResults.length,
    toDateString(lastFetchTime)
  )
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

const distinctSortedSystemNotes = (
  systemNotes: SystemNoteResult[]
): SystemNoteResult[] => _(systemNotes)
  .sortBy(note => note.date)
  .reverse()
  .uniqBy(note => getKeyForNote(note))
  .value()

const indexSystemNotes = (
  systemNotes: SystemNoteResult[]
): Record<string, ModificationInformation> =>
  Object.fromEntries(systemNotes.map(
    systemnote => [getKeyForNote(systemnote), { name: systemnote.name, date: systemnote.date }]
  ))

const fetchSystemNotes = async (
  client: NetsuiteClient,
  queryIds: string[],
  lastFetchTime: Date,
  timeZone: string,
): Promise<Record<string, ModificationInformation>> => {
  const now = moment.tz(timeZone)
  const systemNotes = await log.time(
    () => querySystemNotes(client, queryIds, lastFetchTime),
    'querySystemNotes'
  )
  if (_.isEmpty(systemNotes)) {
    log.warn('System note query failed')
    return {}
  }
  return indexSystemNotes(
    distinctSortedSystemNotes(
      systemNotes.filter(
        systemNote => isDefined(systemNote.date) && !now.isBefore(moment.tz(systemNote.date, timeZone))
      )
    )
  )
}

const getInstancesWithInternalIds = (elements: Element[]): InstanceElement[] =>
  elements
    .filter(isInstanceElement)
    .filter(hasInternalId)
    .filter(instance => instance.elemID.typeName.toLowerCase() in TYPES_TO_INTERNAL_ID)

const getCustomRecordTypesWithInternalIds = (elements: Element[]): ObjectType[] =>
  elements
    .filter(isObjectType)
    .filter(isCustomRecordType)
    .filter(hasInternalId)

const getCustomRecordsWithInternalIds = (elements: Element[]): Promise<InstanceElement[]> =>
  awu(elements)
    .filter(isInstanceElement)
    .filter(hasInternalId)
    .filter(async instance => isCustomRecordType(await instance.getType()))
    .toArray()

const filterCreator: FilterCreator = ({ client, config, elementsSource, elementsSourceIndex, isPartial }): FilterWith<'onFetch'> => ({
  name: 'systemNoteAuthorInformation',
  onFetch: async elements => {
    // if undefined, we want to be treated as true so we check `=== false`
    if (config.fetch?.authorInformation?.enable === false) {
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
    const customRecordTypeNames = new Set(
      customRecordsWithInternalIds.map(({ elemID }) => elemID.typeName)
    )

    const queryIds = _.uniq(instancesWithInternalId
      .map(instance => TYPES_TO_INTERNAL_ID[instance.elemID.typeName.toLowerCase()]))
    if (customRecordTypesWithInternalIds.length > 0) {
      queryIds.push(
        ...customRecordTypesWithInternalIds
          .filter(({ elemID }) => customRecordTypeNames.has(elemID.name))
          .map(getInternalId)
          .concat(TYPES_TO_INTERNAL_ID[CUSTOM_RECORD_TYPE])
      )
    }

    if (_.isEmpty(queryIds)) {
      return
    }
    const employeeNames = await fetchEmployeeNames(client)
    const { timeZone } = await getZoneAndFormat(elements, elementsSource, isPartial)
    const systemNotes = !_.isEmpty(employeeNames)
      ? await fetchSystemNotes(client, queryIds, lastFetchTime, timeZone)
      : {}
    const { elemIdToChangeByIndex, elemIdToChangeAtIndex } = await elementsSourceIndex.getIndexes()
    if (_.isEmpty(systemNotes) && _.isEmpty(elemIdToChangeByIndex)
    && _.isEmpty(elemIdToChangeAtIndex)) {
      return
    }

    const setChangedBy = (element: Element, employeeId: string): void => {
      if (isDefined(employeeId) && isDefined(employeeNames[employeeId])) {
        element.annotate(
          { [CORE_ANNOTATIONS.CHANGED_BY]: employeeNames[employeeId] }
        )
      } else {
        const changedBy = elemIdToChangeByIndex[element.elemID.getFullName()]
        if (isDefined(changedBy)) {
          element.annotate(
            { [CORE_ANNOTATIONS.CHANGED_BY]: changedBy }
          )
        }
      }
    }

    const setChangedAt = async (element: Element, lastModifiedDate: string): Promise<void> => {
      if (isDefined(lastModifiedDate)) {
        const [systemNotesDateFormat, systemNotesTimeFormat] = QUERY_DATE_FORMAT.split(' ')
        const formatedDate = changeDateFormat(
          lastModifiedDate, { dateFormat: systemNotesDateFormat, timeZone, timeFormat: systemNotesTimeFormat }
        )
        element.annotate({ [CORE_ANNOTATIONS.CHANGED_AT]: formatedDate })
      } else {
        const changedAt = elemIdToChangeAtIndex[element.elemID.getFullName()]
        if (isDefined(changedAt)) {
          element.annotate(
            { [CORE_ANNOTATIONS.CHANGED_AT]: changedAt }
          )
        }
      }
    }

    instancesWithInternalId.forEach(async instance => {
      const { name: employeeId, date: lastModifiedDate } = systemNotes[getRecordIdAndTypeStringKey(
        instance.value.internalId,
        TYPES_TO_INTERNAL_ID[instance.elemID.typeName.toLowerCase()]
      )] ?? {}
      setChangedBy(instance, employeeId)
      await setChangedAt(instance, lastModifiedDate)
    })
    customRecordTypesWithInternalIds.forEach(async type => {
      const { name: employeeId, date: lastModifiedDate } = systemNotes[getRecordIdAndTypeStringKey(
        type.annotations.internalId,
        TYPES_TO_INTERNAL_ID[CUSTOM_RECORD_TYPE]
      )] ?? {}
      setChangedBy(type, employeeId)
      await setChangedAt(type, lastModifiedDate)
    })
    await awu(customRecordsWithInternalIds).forEach(async instance => {
      const { name: employeeId, date: lastModifiedDate } = systemNotes[getRecordIdAndTypeStringKey(
        getInternalId(instance),
        getInternalId(await instance.getType())
      )] ?? {}
      setChangedBy(instance, employeeId)
      await setChangedAt(instance, lastModifiedDate)
    })
  },
})

export default filterCreator
