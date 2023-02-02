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
import wu from 'wu'
import _ from 'lodash'
import {
  getChangeData, isModificationChange, InstanceElement, isInstanceChange,
  ModificationChange,
  ElemID,
  ChangeError,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { SCRIPT_ID } from '../constants'
import { NetsuiteChangeValidator } from './types'


const { awu } = collections.asynciterable


const getScriptIdsUnderLists = async (instance: InstanceElement):
  Promise<collections.map.DefaultMap<string, Set<string>>> => {
  const pathToScriptIds = new collections.map.DefaultMap<string, Set<string>>(() => new Set())
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (path.isAttrID()) {
        return WALK_NEXT_STEP.SKIP
      }
      if (_.isPlainObject(value) && SCRIPT_ID in value) {
        pathToScriptIds.get(path.getFullName()).add(value.scriptid)
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

const changeValidator: NetsuiteChangeValidator = async changes => {
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
