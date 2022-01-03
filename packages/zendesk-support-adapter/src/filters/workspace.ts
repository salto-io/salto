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
import _ from 'lodash'
import {
  Change, getChangeElement, InstanceElement, isRemovalChange, Values,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { deployChange } from '../deployment'

const WORKSPACE_TYPE_NAME = 'workspace'

/**
 * Deploys workspaces
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [workspaceChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeElement(change).elemID.typeName === WORKSPACE_TYPE_NAME,
    )
    const result = await Promise.all(
      workspaceChanges.map(async change => {
        try {
          if (!isRemovalChange(change)) {
            await applyFunctionToChangeData(change, workspace => {
              workspace.value = {
                ..._.omit(workspace.value, ['selected_macros']),
                macros: (workspace.value.selected_macros ?? [])
                  .filter(_.isPlainObject)
                  .map((e: Values) => e.id)
                  .filter(values.isDefined),
              }
              return workspace
            })
          }
          await deployChange(change, client, config.apiDefinitions)
          return change
        } catch (err) {
          if (!_.isError(err)) {
            throw err
          }
          return err
        }
      })
    )

    const [errors, appliedChanges] = _.partition(result, _.isError)
    return {
      deployResult: { appliedChanges, errors },
      leftoverChanges,
    }
  },
})

export default filterCreator
