/*
*                      Copyright 2020 Salto Labs Ltd.
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
  ChangeValidator, getChangeElement, isModificationChange, InstanceElement, isInstanceChange,
  ModificationChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import wu from 'wu'
import { customTypes } from '../types'
import { CAPTURE, scriptIdReferenceRegex } from '../constants'


const getScriptId = (value: unknown): string | undefined => {
  if (isReferenceExpression(value)
    && !customTypes[value.elemId.typeName] !== undefined
    && typeof value.value === 'string') {
    return value.value
  }
  if (typeof value === 'string') {
    return value.match(scriptIdReferenceRegex)?.groups?.[CAPTURE]
  }
  if (typeof value === 'object'
    && value !== null
    && 'scriptid' in value) {
    const valueWithScriptID = value as { scriptid: unknown }
    if (typeof valueWithScriptID.scriptid === 'string') {
      return valueWithScriptID.scriptid
    }
  }
  return undefined
}

const getScriptIdsUnderLists = (instance: InstanceElement): Record<string, Set<string>> => {
  const pathToscriptIds: Record<string, Set<string>> = {}
  transformValues({
    values: instance.value,
    type: instance.type,
    transformFunc: ({ value, path }) => {
      if (path !== undefined && Array.isArray(value)) {
        wu(value)
          .map(getScriptId)
          .filter(values.isDefined)
          .forEach(id => {
            if (!(path.getFullName() in pathToscriptIds)) {
              pathToscriptIds[path.getFullName()] = new Set()
            }
            pathToscriptIds[path.getFullName()].add(id)
          })
      }
      return value
    },
    pathID: instance.elemID,
    strict: false,
  })
  return pathToscriptIds
}

const doesContain = <T>(firstSet: Set<T>, secondSet: Set<T>): boolean =>
  wu(firstSet).every(firstValue => secondSet.has(firstValue))


const hasItemRemoval = (change: ModificationChange<InstanceElement>): boolean => {
  const idsUnderListsBefore = getScriptIdsUnderLists(change.data.before)
  const idsUnderListsAfter = getScriptIdsUnderLists(change.data.after)
  return wu.entries(idsUnderListsBefore).some(
    ([path, beforeIds]) =>
      path in idsUnderListsAfter
      && !doesContain(beforeIds, idsUnderListsAfter[path])
  )
}

const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(hasItemRemoval)
    .map(getChangeElement)
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: 'Removing custom type ids from lists is forbidden',
      detailedMessage: `${elemID.name} has id that were removed from a list`,
    }))
)

export default changeValidator
