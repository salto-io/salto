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
import NetsuiteClient from '../../client/client'
import { FilterCreator, FilterWith } from '../../filter'
import { EmployeeResult, EMPLOYEE_NAME_QUERY, EMPLOYEE_SCHEMA, FileSystemNoteResult as SystemNoteFilesResult, FILE_SYSTEM_NOTE_SCHEMA } from './constants'

const SYSTEM_NOTE_FILE_QUERY = 'SELECT systemnote.recordid, systemnote.name FROM systemnote WHERE systemnote.recordtypeid IS NULL AND EXISTS (SELECT file.id FROM file WHERE file.id = systemnote.recordid)'
const { isDefined } = lowerDashValues
const log = logger(module)

const isFileOrFolderInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === 'file' || instance.elemID.typeName === 'folder'

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

const querySystemNotes = async (client: NetsuiteClient):
Promise<SystemNoteFilesResult[]> => {
  const systemNoteResults = await client.runSuiteQL(SYSTEM_NOTE_FILE_QUERY)
  if (systemNoteResults === undefined) {
    return []
  }
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<SystemNoteFilesResult[]>(FILE_SYSTEM_NOTE_SCHEMA, systemNoteResults)) {
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
  systemNotes: SystemNoteFilesResult[]
): SystemNoteFilesResult[] =>
  _.uniqBy(systemNotes, note => note.recordid)

const fetchSystemNotes = async (
  client: NetsuiteClient,
): Promise<Record<string, string>> => {
  const systemNotes = await querySystemNotes(client)
  if (_.isEmpty(systemNotes)) {
    log.warn('System note query failed')
    return {}
  }
  return Object.fromEntries(
    distinctSortedSystemNotes(systemNotes).map(note => [note.recordid, note.name])
  )
}

const filterCreator: FilterCreator = ({ client }): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const fileInstances = elements
      .filter(isInstanceElement)
      .filter(isFileOrFolderInstance)
    if (_.isEmpty(fileInstances)) {
      return
    }
    const employeeNames = await fetchEmployeeNames(client)
    if (_.isEmpty(employeeNames)) {
      return
    }
    const systemNotes = await fetchSystemNotes(client)
    if (_.isEmpty(systemNotes)) {
      return
    }
    fileInstances.forEach(search => {
      if (isDefined(systemNotes[search.value.internalId])) {
        search.annotate(
          { [CORE_ANNOTATIONS.CHANGED_BY]: employeeNames[systemNotes[search.value.internalId]] }
        )
      }
    })
  },
})

export default filterCreator
