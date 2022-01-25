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

import { CORE_ANNOTATIONS, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import Ajv from 'ajv'
import { TYPES_TO_INTERNAL_ID } from '../data_elements/types'
import NetsuiteClient from '../client/client'
import { FilterCreator, FilterWith } from '../filter'

const { isDefined } = lowerDashValues
const log = logger(module)
const UNDERSCORE = '_'
export const EMPLOYEE_NAME_QUERY = 'SELECT id, entityid FROM employee ORDER BY id ASC'
const EMPLOYEE_SCHEMA = {
  items: {
    properties: {
      entityid: {
        type: 'string',
      },
      id: {
        type: 'string',
      },
    },
    required: [
      'entityid',
      'id',
    ],
    type: 'object',
  },
  type: 'array',
}

type EmployeeResult = {
  id: string
  entityid: string
}

const SYSTEM_NOTE_SCHEMA = {
  items: {
    properties: {
      name: {
        type: 'string',
      },
      recordid: {
        type: 'string',
      },
      recordtypeid: {
        type: 'string',
      },
    },
    required: [
      'name',
      'recordid',
      'recordtypeid',
    ],
    type: 'object',
  },
  type: 'array',
}

type SystemNoteResult = {
  recordid: string
  recordtypeid: string
  name: string
}

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

const distinctSortedSystemNotes = (
  systemNotes: Record<string, string>[]
): Record<string, string>[] =>
  _.uniqBy(systemNotes, note => [note.recordid, note.recordtypeid].join(','))

const buildSystemNotesQuery = (instances: InstanceElement[]): string | undefined => {
  const recordTypeIds = _.uniq(instances
    .map(instance => TYPES_TO_INTERNAL_ID[instance.elemID.typeName]))
  if (_.isEmpty(recordTypeIds)) {
    return undefined
  }
  const whereQuery = recordTypeIds
    .map(recordType => `recordtypeid = '${recordType}'`)
    .join(' or ')
  return `SELECT recordid, recordtypeid, name FROM systemnote WHERE ${whereQuery} ORDER BY date DESC`
}

const fetchSystemNotes = async (
  client: NetsuiteClient,
  query: string
): Promise<Record<string, Record<string, string>>> => {
  const systemNotes = await querySystemNotes(client, query)
  if (_.isEmpty(systemNotes)) {
    log.warn('System note query failed')
    return {}
  }
  return _.keyBy(distinctSortedSystemNotes(systemNotes),
    note => getRecordIdAndTypeStringKey(note.recordid, note.recordtypeid))
}

const getElementLastModifier = (
  instance: InstanceElement,
  systemNotes: Record<string, Record<string, string>>,
  employeeNames: Record<string, string>,
): string | undefined => {
  const lastNote = systemNotes[
    getRecordIdAndTypeStringKey(
      instance.value.internalId,
      TYPES_TO_INTERNAL_ID[instance.elemID.typeName]
    )]
  if (_.isEmpty(lastNote)) {
    return undefined
  }
  return employeeNames[lastNote.name]
}
const setAuthorName = (
  instance: InstanceElement,
  systemNotes: Record<string, Record<string, string>>,
  employeeNames: Record<string, string>,
): void => {
  const authorName = getElementLastModifier(instance, systemNotes, employeeNames)
  if (authorName) {
    instance.annotate({ [CORE_ANNOTATIONS.CHANGED_BY]: authorName })
  }
}

const filterCreator: FilterCreator = ({ client }): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const instancesWithInternalId = elements
      .filter(isInstanceElement)
      .filter(instance => isDefined(instance.value.internalId))
      .filter(instance => instance.elemID.typeName in TYPES_TO_INTERNAL_ID)
    const systemNoteQuery = buildSystemNotesQuery(instancesWithInternalId)
    if (_.isUndefined(systemNoteQuery)) {
      return
    }
    const employeeNames = await fetchEmployeeNames(client)
    if (_.isEmpty(employeeNames)) {
      return
    }
    const systemNotes = await fetchSystemNotes(client, systemNoteQuery)
    instancesWithInternalId
      .forEach(instance => setAuthorName(instance, systemNotes, employeeNames))
  },
})

export default filterCreator
