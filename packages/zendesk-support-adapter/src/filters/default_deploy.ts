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
import { Change, InstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { deployChange } from '../deployment'

/**
 * Deploys all the changes that were not deployed by the previous filters
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const result = await Promise.all(
      changes.map(async change => {
        try {
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
      leftoverChanges: [],
    }
  },
})

export default filterCreator
