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
import { InstanceElement, Value, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { WALK_NEXT_STEP, walkOnElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import { SCRIPT_ID } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

const getRelativePathAndScriptId = (path: string): {
  relativePath: string
  scriptId: string
} | undefined => {
  const fullNameRegex = /\.instance\.(?<instance_name>\w+)\.(?<relative_path>[\w.]+(?=\.\w+$))\.(?<scriptid>\w+)$/
  const match = path.match(fullNameRegex)
  if (match && match.groups) {
    return { relativePath: match.groups.relative_path, scriptId: match.groups.scriptid }
  }
  return undefined
}

const getScriptIdsUnderLists = async (instance: InstanceElement):
  Promise<Map<string, { relativePath: string; id:string; val: Value}>> => {
  const pathToScriptIds = new Map<string, { relativePath: string; id:string; val: Value}>()
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (path.isAttrID()) {
        return WALK_NEXT_STEP.SKIP
      }
      if (_.isPlainObject(value) && SCRIPT_ID in value) {
        const fullNameSplit = getRelativePathAndScriptId(path.getFullName())
        if (fullNameSplit !== undefined) {
          const { relativePath, scriptId } = fullNameSplit
          pathToScriptIds.set(path.getFullName(), { relativePath, id: scriptId, val: value })
        }
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return pathToScriptIds
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'restorDeletedListItems',
  onDeploy: async changes => {
    log.debug('')
    await awu(changes)
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .forEach(async instanceChange => {
        const before = await getScriptIdsUnderLists(instanceChange.data.before)
        const after = await getScriptIdsUnderLists(instanceChange.data.after)
        before.forEach((value, key) => {
          if (!after.has(key)) {
            _.get(instanceChange.data.after.value, value.relativePath)[value.id] = value.val
            log.debug('')
          }
        })
      })
  },
})

export default filterCreator
