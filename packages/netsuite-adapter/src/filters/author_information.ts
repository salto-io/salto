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
import _, { isUndefined } from 'lodash'
import { TYPES_TO_INTERNAL_ID } from '../data_elements/types'
import NetsuiteClient from '../client/client'
import { FilterCreator, FilterWith } from '../filter'

const log = logger(module)
export const EMPLOYEE_NAME_QUERY = 'SELECT id, entityid FROM employee'
export const SYSTEM_NOTE_QUERY = 'SELECT recordid, recordtypeid, name FROM systemnote ORDER BY date ASC'

const fetchEmployeeNames = async (client: NetsuiteClient): Promise<Record<string, string>> => {
  const employees = await client.runSuiteQL(EMPLOYEE_NAME_QUERY)
  if (employees) {
    return Object.fromEntries(employees.map(entry => [entry.id, entry.entityid]))
  }
  return {}
}

const distinctSortedSystemNotes = (
  systemNotes: Record<string, unknown>[]
): Record<string, unknown>[] =>
  Object.values(
    _.groupBy(
      systemNotes
        .filter(note => Object.keys(note).length === 3),
      note => [note.recordid, note.recordtypeid]
    )
  ).map(notes => notes[0])

const fetchSystemNotes = async (client: NetsuiteClient): Promise<Record<string, unknown>[]> => {
  const systemNotes = await client.runSuiteQL(SYSTEM_NOTE_QUERY)
  if (systemNotes) {
    return distinctSortedSystemNotes(systemNotes)
  }
  log.warn('System note query failed')
  return []
}

const filterCreator: FilterCreator = ({ client }): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    const employeeNames = await fetchEmployeeNames(client)
    const systemNotes = await fetchSystemNotes(client)
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
      .filter(instance => !isUndefined(instance.value.internalId))
      .forEach(setAuthorName)
  },
})

export default filterCreator
