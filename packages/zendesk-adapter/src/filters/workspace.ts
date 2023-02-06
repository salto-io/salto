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
import _ from 'lodash'
import {
  Change, getChangeData, InstanceElement, isRemovalChange, Values,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { applyforInstanceChangesOfType } from './utils'

const WORKSPACE_TYPE_NAME = 'workspace'

/**
 * Deploys workspaces
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'workspaceFilter',
  preDeploy: async changes => {
    await applyforInstanceChangesOfType(
      changes,
      [WORKSPACE_TYPE_NAME],
      (instance: InstanceElement) => {
        instance.value = {
          ...instance.value,
          macros: (instance.value.selected_macros ?? [])
            .filter(_.isPlainObject)
            .map((e: Values) => e.id)
            .filter(values.isDefined),
        }
        return instance
      }
    )
  },
  onDeploy: async changes => {
    await applyforInstanceChangesOfType(
      changes,
      [WORKSPACE_TYPE_NAME],
      (instance: InstanceElement) => {
        instance.value = _.omit(instance.value, ['macros'])
        return instance
      }
    )
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [workspaceChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        (getChangeData(change).elemID.typeName === WORKSPACE_TYPE_NAME)
        && !isRemovalChange(change),
    )
    const deployResult = await deployChanges(
      workspaceChanges,
      async change => {
        await deployChange(
          change, client, config.apiDefinitions, ['selected_macros'],
        )
      },
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
