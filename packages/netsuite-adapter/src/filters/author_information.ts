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

import { CORE_ANNOTATIONS, InstanceElement, isInstanceElement, Element } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { TYPES_TO_INTERNAL_ID } from '../data_elements/types'
import NetsuiteClient from '../client/client'
import { FilterCreator, FilterWith } from '../filter'

const log = logger(module)

const fetchEmployeeNames = async (client: NetsuiteClient): Promise<Record<string, string>> => {
  const employees = await client.runSuiteQL(`
      SELECT id, entityid
      FROM employee 
    `)
  if (employees) {
    return Object.fromEntries(employees.map(entry => [entry.id, entry.entityid]))
  }
  return {}
}

const fetchSystemNotes = async (client: NetsuiteClient): Promise<Record<string, unknown>[]> => {
  const systemNotes = await client.runSuiteQL(`
      SELECT recordid, recordtypeid, name
      FROM systemnote
      GROUP BY recordid, recordtypeid, name
    `)
  if (systemNotes) {
    return systemNotes
  }
  log.warn('system note query failed')
  return []
}

const fetchRecordIdsForRecordType = async (
  recordType: string,
  client: NetsuiteClient
): Promise<Record<string, string>[]> => {
  const recordTypeIds = await client.runSuiteQL(`
  SELECT scriptid, internalid
  FROM ${recordType}`)
  if (recordTypeIds) {
    return Object.fromEntries(recordTypeIds.map(entry => [entry.scriptid, entry.internalid]))
  }

  const recordTypeIds2 = await client.runSuiteQL(`
  SELECT scriptid, id
  FROM ${recordType}`)
  if (recordTypeIds2) {
    return Object.fromEntries(recordTypeIds2.map(entry => [entry.scriptid, entry.id]))
  }
  log.warn(`${recordType} query failed`)
  return []
}

const createRecordIdsMap = async (
  client: NetsuiteClient,
  recordTypes: string[]
): Promise<Record<string, Record<string, string>>> =>
  Object.fromEntries(
    await Promise.all(recordTypes
      .map(async recordType =>
        [recordType, await fetchRecordIdsForRecordType(recordType, client)]))
  )

const getElementRecordId = (
  element: InstanceElement,
  recordIdsMap: Record<string, Record<string, string>>,
): string | undefined => {
  if (element.value.internalId) {
    return element.value.internalId
  }
  if (element.value.scriptid && recordIdsMap[element.elemID.typeName][element.value.scriptid]) {
    return recordIdsMap[element.elemID.typeName][element.value.scriptid]
  }
  return undefined
}

const getElementsRecordTypeIdSet = (elements: Element[]): string[] =>
  _.uniq(elements.filter(isInstanceElement).map(elem => elem.elemID.typeName))

const filterCreator: FilterCreator = ({ client }): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    const employeeNames = await fetchEmployeeNames(client)
    const systemNotes = await fetchSystemNotes(client)
    const recordIdMap = await createRecordIdsMap(
      client, getElementsRecordTypeIdSet(elements)
    )
    const getElementLastModifier = (
      element: InstanceElement,
    ): string | undefined => {
      const matchingNotes = systemNotes
        .filter(note => note.recordid === getElementRecordId(element, recordIdMap))
        .filter(note => TYPES_TO_INTERNAL_ID[element.elemID.typeName] === note.recordtypeid)
      if (matchingNotes.length > 0) {
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
      .forEach(setAuthorName)
  },
})

export default filterCreator
