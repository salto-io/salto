/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { Change, InstanceElement, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { deployChanges } from '../../deployment/standard_deployment'
import { FIELD_CONTEXT_TYPE_NAME } from './constants'
import { updateDefaultValues } from './default_values'

const filter: FilterCreator = ({ client, config, elementsSource }) => ({
  name: 'contextDefaultValueDeploymentFilter',
  deploy: async changes => {
    if (!config.fetch.splitFieldContextOptions) {
      return { leftoverChanges: changes, deployResult: { errors: [], appliedChanges: [] } }
    }
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME,
    ) as [Change<InstanceElement>[], Change[]]
    const deployResult = await deployChanges(relevantChanges, async change => {
      await updateDefaultValues(change, client, config, elementsSource)
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
