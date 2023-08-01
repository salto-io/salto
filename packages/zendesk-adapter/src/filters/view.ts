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
  Change, getChangeData, InstanceElement, isRemovalChange, Value, Values,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { applyforInstanceChangesOfType } from './utils'

export const VIEW_TYPE_NAME = 'view'

const valToString = (val: Value): string | string[] => (_.isArray(val) ? val.map(String) : val?.toString())

/**
 * Deploys views
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'viewFilter',
  preDeploy: async changes => {
    await applyforInstanceChangesOfType(
      changes,
      [VIEW_TYPE_NAME],
      (instance: InstanceElement) => {
        instance.value = {
          ...instance.value,
          all: (instance.value.conditions.all ?? [])
            .map((e: Values) => ({ ...e, value: valToString(e.value) })),
          any: (instance.value.conditions.any ?? [])
            .map((e: Values) => ({ ...e, value: valToString(e.value) })),
          output: {
            ...instance.value.execution,
            group_by: instance.value.execution.group_by?.toString(),
            sort_by: instance.value.execution.sort_by?.toString(),
            columns: instance.value.execution.columns?.filter(_.isPlainObject)
              .map((c: Values) => c.id).filter(values.isDefined) ?? [],
          },
        }
        return instance
      }
    )
  },
  onDeploy: async changes => {
    await applyforInstanceChangesOfType(
      changes,
      [VIEW_TYPE_NAME],
      (instance: InstanceElement) => {
        instance.value = _.omit(instance.value, ['all', 'any', 'output'])
        return instance
      }
    )
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [viewChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        (getChangeData(change).elemID.typeName === VIEW_TYPE_NAME)
        && !isRemovalChange(change),
    )
    const deployResult = await deployChanges(
      viewChanges,
      async change => {
        await deployChange(
          change, client, config.apiDefinitions, ['conditions', 'execution'],
        )
      },
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
