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
  Change, getChangeElement, InstanceElement, isAdditionChange, Values,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { deployment as deploymentUtils, config as configUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'

const log = logger(module)

/**
 * Deploys all the changes that were not deployed by the previous filters
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const { apiDefinitions } = config
    const result = await Promise.all(
      changes.map(async change => {
        const { deployRequests, transformation } = apiDefinitions
          .types[getChangeElement(change).elemID.typeName]
        try {
          const response = await deploymentUtils.deployChange(change, client, deployRequests)
          if (isAdditionChange(change)) {
            if (_.isArray(response)) {
              log.warn(
                'Received an array for the response of the deploy. Do not update the id of the element. Action: add. ID: %s',
                getChangeElement(change).elemID.getFullName()
              )
            } else {
              const transformationConfig = configUtils.getConfigWithDefault(
                transformation,
                apiDefinitions.typeDefaults.transformation,
              )
              const idField = transformationConfig.serviceIdField ?? 'id'
              const dataField = deployRequests?.add?.deployAsField
              const idValue = dataField
                ? (response?.[dataField] as Values)?.[idField]
                : response?.[idField]
              if (idValue !== undefined) {
                getChangeElement(change).value[idField] = idValue
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
      leftoverChanges: [],
    }
  },
})

export default filterCreator
