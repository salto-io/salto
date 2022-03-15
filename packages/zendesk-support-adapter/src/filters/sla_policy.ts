/*
*                      Copyright 2022 Salto Labs Ltd.
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
  Change, getChangeData, InstanceElement, isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'

export const SLA_POLICY_TYPE_NAME = 'sla_policy'

/**
 * Deploys sla policy
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [slaPoliciesChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        (getChangeData(change).elemID.typeName === SLA_POLICY_TYPE_NAME)
        && isAdditionOrModificationChange(change),
    )
    const deployResult = await deployChanges(
      slaPoliciesChanges,
      async change => {
        const currentInstance = getChangeData(change)
        const newInstance = getChangeData(change).clone()
        newInstance.value.filter = newInstance.value.filter ?? { all: [], any: [] }
        getChangeData(change).value = newInstance.value
        await deployChange(
          change, client, config.apiDefinitions,
        )
        getChangeData(change).value = currentInstance.value
      },
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
