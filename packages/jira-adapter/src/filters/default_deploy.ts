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
import { isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { deployChange } from '../deployment'
import { FilterCreator } from '../filter'

const filter: FilterCreator = ({ client, config }) => ({
  deploy: async changes => {
    const result = await Promise.all(
      changes.filter(isInstanceChange).map(async change => {
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
      leftoverChanges: [],
      deployResult: {
        errors,
        appliedChanges,
      },
    }
  },
})

export default filter
