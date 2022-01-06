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
  Change, getChangeData, InstanceElement, isRemovalChange, Values,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { deployChange } from '../deployment'

const log = logger(module)

const VIEW_TYPE_NAME = 'view'

/**
 * Deploys views
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [viewChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        (getChangeData(change).elemID.typeName === VIEW_TYPE_NAME)
        && !isRemovalChange(change),
    )
    const result = await Promise.all(
      viewChanges.map(async change => {
        try {
          await applyFunctionToChangeData(change, view => {
            try {
              view.value = {
                ..._.omit(view.value, ['conditions', 'execution']),
                all: (view.value.conditions.all ?? [])
                  .map((e: Values) => ({ ...e, value: e.value.toString() })),
                any: (view.value.conditions.any ?? [])
                  .map((e: Values) => ({ ...e, value: e.value.toString() })),
                output: {
                  ..._.omit(view.value.execution, ['fields', 'custom_fields']),
                  columns: view.value.execution.columns?.filter(_.isPlainObject)
                    .map((c: Values) => c.id).filter(values.isDefined) ?? [],
                },
              }
              return view
            } catch (e) {
              log.error('View %s has an invalid format and cannot be deployed. Error: %o',
                getChangeData(change).elemID.getFullName(), e)
              throw e
            }
          })
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
