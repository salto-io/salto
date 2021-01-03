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
  ElemID,
} from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import wu from 'wu'
import _ from 'lodash'


const getScriptId = (value: unknown): string | undefined => {
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

const getScriptIdsUnderLists = (instance: InstanceElement):
  collections.map.DefaultMap<string, Set<string>> => {
  const pathToScriptIds = new collections.map.DefaultMap<string, Set<string>>(() => new Set())
  transformValues({
    values: instance.value,
    type: instance.type,
    transformFunc: ({ value, path }) => {
      if (path !== undefined && Array.isArray(value)) {
        wu(value)
          .map(getScriptId)
          .filter(values.isDefined)
          .forEach(id => {
            pathToScriptIds.get(path.getFullName()).add(id)
          })
      }
      return value
    },
    pathID: instance.elemID,
    strict: false,
  })
  return pathToScriptIds
}

const getRemovedListItems = (change: ModificationChange<InstanceElement>):
  {
    removedListItems: string[]
    elemID: ElemID
  } => {
  const idsUnderListsBefore = getScriptIdsUnderLists(change.data.before)
  const idsUnderListsAfter = getScriptIdsUnderLists(change.data.after)
  const removedListItems = wu(idsUnderListsBefore.entries()).map(
    ([path, beforeIds]) =>
      wu(beforeIds).filter(beforeId => !idsUnderListsAfter.get(path).has(beforeId))
  ).flatten().toArray()
  return { removedListItems, elemID: getChangeElement(change).elemID }
}

const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .map(getRemovedListItems)
    .filter(({ removedListItems }) => !_.isEmpty(removedListItems))
    .map(({ elemID, removedListItems }) => ({
      elemID,
      severity: 'Error',
      message: 'Removing inner elements from custom types is forbidden',
      detailedMessage: `Unable to remove the following inner element scriptids from ${elemID.name}: ${removedListItems}`,
    }))
)

export default changeValidator
