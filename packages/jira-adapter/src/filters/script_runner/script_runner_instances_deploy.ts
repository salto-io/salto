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
import { getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { FilterCreator } from '../../filter'

// This filter deploys script runner instances
const filter: FilterCreator = ({ scriptRunnerClient, config }) => ({
  name: 'scripRunnerInstancesDeployFilter',
  deploy: async changes => {
    const { scriptRunnerApiDefinitions } = config
    if (!config.fetch.enableScriptRunnerAddon || scriptRunnerApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && scriptRunnerApiDefinitions.types[getChangeData(change).elemID.typeName] !== undefined
    )
    if (relevantChanges.length === 0) {
      return {
        leftoverChanges,
        deployResult: { errors: [], appliedChanges: [] },
      }
    }
    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => {
        await defaultDeployChange({
          change,
          client: scriptRunnerClient,
          apiDefinitions: scriptRunnerApiDefinitions,
        })
      },
    )
    return { deployResult, leftoverChanges }
  },
})

export default filter
