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
  Change, getChangeElement, InstanceElement, isAdditionChange, isRemovalChange, Values,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { deployment as deploymentUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'

const log = logger(module)

const VIEW_TYPE_NAME = 'view'

/**
 * Deploys views
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [viewChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeElement(change).elemID.typeName === VIEW_TYPE_NAME,
    )
    const { deployRequests } = config.apiDefinitions.types[VIEW_TYPE_NAME]
    const result = await Promise.all(
      viewChanges.map(async change => {
        try {
          if (!isRemovalChange(change)) {
            await applyFunctionToChangeData(change, view => {
              try {
                view.value = _.omit({
                  ...view.value,
                  all: view.value.conditions?.all ?? [],
                  any: view.value.conditions?.any ?? [],
                  output: {
                    ...(view.value.execution ?? {}),
                    columns: view.value.execution?.columns?.map((c: Values) => c.id) ?? [],
                  },
                }, ['conditions', 'execution'])
                return view
              } catch (e) {
                log.error('The view that is trying to be deployed is in invalid format')
                throw e
              }
            })
          }
          const response = await deploymentUtils.deployChange(change, client, deployRequests)
          if (isAdditionChange(change)) {
            if (_.isArray(response)) {
              log.warn(
                'Received an array for the response of the deploy. Do not update the id of the element. Action: add. ID: %s',
                getChangeElement(change).elemID.getFullName()
              )
            } else {
              const idValue = (response?.view as Values)?.id
              if (idValue !== undefined) {
                getChangeElement(change).value.id = idValue
              }
            }
          }
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
