/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import { ElemID, InstanceElement, Value, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { WALK_NEXT_STEP, setPath, walkOnElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import { SCRIPT_ID } from '../constants'

const { awu } = collections.asynciterable

const getScriptIdsUnderLists = (instance: InstanceElement): Map<string, { elemID: ElemID; val: Value }> => {
  const pathToScriptIds = new Map<string, { elemID: ElemID; val: Value }>()
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (path.isAttrID()) {
        return WALK_NEXT_STEP.SKIP
      }
      if (_.isPlainObject(value) && SCRIPT_ID in value && !path.isTopLevel()) {
        pathToScriptIds.set(path.getFullName(), { elemID: path, val: value })
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return pathToScriptIds
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'restoreDeletedListItems',
  onDeploy: async changes => {
    await awu(changes)
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .forEach(async instanceChange => {
        const before = getScriptIdsUnderLists(instanceChange.data.before)
        const after = getScriptIdsUnderLists(instanceChange.data.after)
        before.forEach((value, key) => {
          if (!after.has(key)) {
            setPath(instanceChange.data.after, value.elemID, value.val)
          }
        })
      })
  },
})

export default filterCreator
