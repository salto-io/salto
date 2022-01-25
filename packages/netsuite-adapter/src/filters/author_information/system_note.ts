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

import { CORE_ANNOTATIONS, InstanceElement, isInstanceElement, Element } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import Ajv from 'ajv'
import { TYPES_TO_INTERNAL_ID as ORIGINAL_TYPES_TO_INTERNAL_ID } from '../../data_elements/types'
import NetsuiteClient from '../../client/client'
import { FilterCreator, FilterWith } from '../../filter'
import { EmployeeResult, EMPLOYEE_NAME_QUERY, EMPLOYEE_SCHEMA, SystemNoteResult, SYSTEM_NOTE_SCHEMA } from './constants'

const { isDefined } = lowerDashValues
const log = logger(module)
const UNDERSCORE = '_'
export const FILE_FIELD_IDENTIFIER = 'MEDIAITEM.'
export const FOLDER_FIELD_IDENTIFIER = 'MEDIAITEMFOLDER.'
const FILE_TYPE = 'FILE_TYPE'
const FOLDER_TYPE = 'FOLDER_TYPE'

const TYPES_TO_INTERNAL_ID: Record<string, string> = _.mapKeys({
  ...ORIGINAL_TYPES_TO_INTERNAL_ID,
  // Types without record type id that are given new ids.
  file: FILE_TYPE,
  folder: FOLDER_TYPE,
}, (_value, key) => key.toLowerCase())

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

const querySystemNotes = async (client: NetsuiteClient, query: string):
Promise<SystemNoteResult[]> => {
  const systemNoteResults = await client.runSuiteQL(query)
  if (systemNoteResults === undefined) {
    return []
  }
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<SystemNoteResult[]>(SYSTEM_NOTE_SCHEMA, systemNoteResults)) {
    log.error(`Got invalid results from system note table: ${ajv.errorsText()}`)
    return []
  }
  return systemNoteResults
}

const fetchEmployeeNames = async (client: NetsuiteClient): Promise<Record<string, string>> => {
  const employees = await queryEmployees(client)
  if (!_.isEmpty(employees)) {
    return Object.fromEntries(employees.map(entry => [entry.id, entry.entityid]))
  }
  return {}
}

const getWhereQueryPart = (recordType: string): string => {
  // File and folder types have system notes without record type ids,
  // But they have a prefix in the field column.
  if (recordType === FILE_TYPE) {
    return `field LIKE '${FILE_FIELD_IDENTIFIER}%'`
  }
  if (recordType === FOLDER_TYPE) {
    return `field LIKE '${FOLDER_FIELD_IDENTIFIER}%'`
  }
  return `recordtypeid = '${recordType}'`
}

const buildSystemNotesQuery = (instances: InstanceElement[]): string | undefined => {
  const recordTypeIds = _.uniq(instances
    .map(instance => TYPES_TO_INTERNAL_ID[instance.elemID.typeName.toLowerCase()]))
  if (_.isEmpty(recordTypeIds)) {
    return undefined
  }
  const whereQuery = recordTypeIds
    .map(getWhereQueryPart)
    .join(' OR ')
  return `SELECT name, field, recordid, recordtypeid FROM systemnote WHERE ${whereQuery} ORDER BY date DESC`
}

const getKeyForNote = (systemNote: SystemNoteResult): string => {
  if (isDefined(systemNote.recordtypeid)) {
    return getRecordIdAndTypeStringKey(systemNote.recordid, systemNote.recordtypeid)
  }
  return systemNote.field.startsWith(FOLDER_FIELD_IDENTIFIER)
    ? getRecordIdAndTypeStringKey(systemNote.recordid, FOLDER_TYPE)
    : getRecordIdAndTypeStringKey(systemNote.recordid, FILE_TYPE)
}

const distinctSortedSystemNotes = (
  systemNotes: SystemNoteResult[]
): SystemNoteResult[] =>
  _.uniqBy(systemNotes, note => getKeyForNote(note))

const indexSystemNotes = (systemNotes: SystemNoteResult[]): Record<string, string> =>
  Object.fromEntries(systemNotes.map(systemnote => [getKeyForNote(systemnote), systemnote.name]))

const fetchSystemNotes = async (
  client: NetsuiteClient,
  query: string
): Promise<Record<string, string>> => {
  const systemNotes = await querySystemNotes(client, query)
  if (_.isEmpty(systemNotes)) {
    log.warn('System note query failed')
    return {}
  }
  return indexSystemNotes(distinctSortedSystemNotes(systemNotes))
}

const getInstancesWithInternalIds = (elements: Element[]): InstanceElement[] =>
  elements
    .filter(isInstanceElement)
    .filter(instance => isDefined(instance.value.internalId))
    .filter(instance => instance.elemID.typeName.toLowerCase() in TYPES_TO_INTERNAL_ID)

const filterCreator: FilterCreator = ({ client }): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const instancesWithInternalId = getInstancesWithInternalIds(elements)
    const systemNoteQuery = buildSystemNotesQuery(instancesWithInternalId)
    if (_.isUndefined(systemNoteQuery)) {
      return
    }
    const employeeNames = await fetchEmployeeNames(client)
    if (_.isEmpty(employeeNames)) {
      return
    }
    const systemNotes = await fetchSystemNotes(client, systemNoteQuery)
    if (_.isEmpty(systemNotes)) {
      return
    }
    instancesWithInternalId.forEach(instance => {
      const employeeId = systemNotes[
        getRecordIdAndTypeStringKey(instance.value.internalId,
          TYPES_TO_INTERNAL_ID[instance.elemID.typeName.toLowerCase()])]
      if (isDefined(employeeId) && isDefined(employeeNames[employeeId])) {
        instance.annotate(
          { [CORE_ANNOTATIONS.CHANGED_BY]: employeeNames[employeeId] }
        )
      }
    })
  },
})

export default filterCreator
