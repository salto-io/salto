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
import { Change, getChangeData, InstanceElement, isInstanceChange } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { API_DEFINITIONS_CONFIG } from '../config'
import { deployChanges } from '../deployment'

/**
 * Deploys changes of types defined with ducktype
 */
const filterCreator: FilterCreator = ({ adminClient, config }) => ({
  name: 'ducktypeDeployFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const { ducktype } = config[API_DEFINITIONS_CONFIG]
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
      && ducktype.types[getChangeData(change).elemID.typeName] !== undefined
    )
    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => {
        const { deployRequests } = ducktype.types[getChangeData(change).elemID.typeName]
        await deployment.deployChange({
          change,
          client: adminClient,
          endpointDetails: deployRequests,
        })
      }
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
