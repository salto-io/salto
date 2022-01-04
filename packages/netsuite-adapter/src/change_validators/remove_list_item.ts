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
import wu from 'wu'
import _ from 'lodash'
import {
  ChangeValidator, getChangeData, isModificationChange, InstanceElement, isInstanceChange,
  ModificationChange,
  ElemID,
  ChangeError,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable


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

const getScriptIdsUnderLists = async (instance: InstanceElement):
  Promise<collections.map.DefaultMap<string, Set<string>>> => {
  const pathToScriptIds = new collections.map.DefaultMap<string, Set<string>>(() => new Set())
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (path.isAttrID()) {
        return WALK_NEXT_STEP.SKIP
      }
      if (Array.isArray(value)) {
        wu(value)
          .map(getScriptId)
          .filter(values.isDefined)
          .forEach(id => {
            pathToScriptIds.get(path.getFullName()).add(id)
          })
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return pathToScriptIds
}

const getRemovedListItems = async (change: ModificationChange<InstanceElement>):
  Promise<{
    removedListItems: string[]
    elemID: ElemID
  }> => {
  const idsUnderListsBefore = await getScriptIdsUnderLists(change.data.before)
  const idsUnderListsAfter = await getScriptIdsUnderLists(change.data.after)
  const removedListItems = wu(idsUnderListsBefore.entries()).map(
    ([path, beforeIds]) =>
      wu(beforeIds).filter(beforeId => !idsUnderListsAfter.get(path).has(beforeId))
  ).flatten().toArray()
  return { removedListItems, elemID: getChangeData(change).elemID }
}

const changeValidator: ChangeValidator = async changes => {
  const instanceChanges = await awu(changes)
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .toArray() as ModificationChange<InstanceElement>[]

  return awu(instanceChanges).map(getRemovedListItems)
    .filter(({ removedListItems }: {removedListItems: string[]}) => !_.isEmpty(removedListItems))
    .map(({ elemID, removedListItems }: {removedListItems: string[]; elemID: ElemID}) => ({
      elemID,
      severity: 'Error',
      message: 'Removing inner elements from custom types is forbidden',
      detailedMessage: `Unable to remove the following inner element scriptids from ${elemID.name}: ${removedListItems}`,
    }))
    .toArray() as Promise<ChangeError[]>
}

export default changeValidator
