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
export const EMPLOYEE_NAME_QUERY = 'SELECT id, entityid FROM employee ORDER BY id ASC'
const EMPLOYEE_SCHEMA = { items: {
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
type: 'array' }

type EmployeeResult = {
  id: string
  entityid: string
}

const SYSTEM_NOTE_SCHEMA = { items: {
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
  ],
  type: 'object',
},
type: 'array' }

type SystemNoteResult = {
  recordid: string
  recordtypeid: string
  name: string
}


const queryEmployees = async (client: NetsuiteClient):
Promise<EmployeeResult[]> => {
  const employeeResults = await client.runSuiteQL(EMPLOYEE_NAME_QUERY)
  if (employeeResults === undefined) {
    return []
  }
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<EmployeeResult[]>(EMPLOYEE_SCHEMA, employeeResults)) {
    log.error(`Got invalid results from listing employees table: ${ajv.errorsText()}`)
    throw new Error('Failed to list employees')
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
    throw new Error('Failed to list system notes')
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
  systemNotes: Record<string, unknown>[]
): Record<string, unknown>[] =>
  _.uniqBy(systemNotes, note => [note.recordid, note.recordtypeid].join(','))

const getRecordIdQueryLine = (recordIds: string[]): string =>
  ['(', recordIds.map(id => `recordid = '${id}'`).join(' or '), ')'].join('')

const getWhereQuery = (recordTypeId: string, recordIds: string[]): string => {
  const recordIdsQueryLine = getRecordIdQueryLine(recordIds)
  return `(${recordIdsQueryLine} AND recordtypeid = '${recordTypeId}')`
}

const buildSystemNotesQuery = (instances: InstanceElement[]): string => {
  const instancesWithID = instances
    .filter(instance => isDefined(instance.value.internalId))
    .filter(instance => isDefined(TYPES_TO_INTERNAL_ID[instance.elemID.typeName]))
  if (_.isEmpty(instancesWithID)) {
    return ''
  }
  const instancesByTypeName = _.groupBy(instancesWithID,
    instance => TYPES_TO_INTERNAL_ID[instance.elemID.typeName])
  const recordTypeIdsToRecordIds = Object.entries(instancesByTypeName)
    .map(entries => [entries[0], entries[1].map(instance => instance.value.internalId)])
  const whereQuery = recordTypeIdsToRecordIds
    .map(entries => getWhereQuery(entries[0] as string, entries[1] as string[])).join(' or ')
  return `SELECT recordid, recordtypeid, name FROM systemnote WHERE ${whereQuery} ORDER BY date DESC`
}

const fetchSystemNotes = async (
  client: NetsuiteClient,
  query: string
): Promise<Record<string, unknown>[]> => {
  const systemNotes = await querySystemNotes(client, query)
  if (_.isEmpty(systemNotes)) {
    return distinctSortedSystemNotes(systemNotes)
  }
  log.warn('System note query failed')
  return []
}

const filterCreator: FilterCreator = ({ client }): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const query = buildSystemNotesQuery(elements.filter(isInstanceElement))
    if (_.isEmpty(query)) {
      return
    }
    const employeeNames = await fetchEmployeeNames(client)
    if (_.isEmpty(employeeNames)) {
      return
    }
    const systemNotes = await fetchSystemNotes(client, query)
    const getElementLastModifier = (
      element: InstanceElement,
    ): string | undefined => {
      const matchingNotes = systemNotes
        .filter(note => TYPES_TO_INTERNAL_ID[element.elemID.typeName] === note.recordtypeid)
        .filter(note => note.recordid === element.value.internalId)
      if (!_.isEmpty(matchingNotes)) {
        return employeeNames[_.toString(matchingNotes[0].name)]
      }
      return undefined
    }
    const setAuthorName = (element: InstanceElement): void => {
      const authorName = getElementLastModifier(element)
      if (authorName) {
        element.annotate({ [CORE_ANNOTATIONS.CHANGED_BY]: authorName })
      }
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => isDefined(instance.value.internalId))
      .forEach(setAuthorName)
  },
})

export default filterCreator
