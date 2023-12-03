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
import { getChangeData, isInstanceChange, Change, InstanceElement } from '@salto-io/adapter-api'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'
import { JSM_DUCKTYPE_SUPPORTED_TYPES } from '../config/api_config'
import { ASSESTS_SCHEMA_TYPE, ASSETS_OBJECT_TYPE, ASSETS_STATUS_TYPE } from '../constants'
import { getWorkspaceId } from '../workspace_id'

const ASSETS_SUPPORTED_TYPES = [ASSESTS_SCHEMA_TYPE, ASSETS_STATUS_TYPE, ASSETS_OBJECT_TYPE]
const SUPPORTED_TYPES = new Set(Object.keys(JSM_DUCKTYPE_SUPPORTED_TYPES).concat(ASSETS_SUPPORTED_TYPES))

const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'jsmDeployFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const [jsmTypesChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        SUPPORTED_TYPES.has(getChangeData(change).elemID.typeName)
        && isInstanceChange(change)
    )
    const workspaceId = await getWorkspaceId(client)
    const additionalUrlVars = workspaceId ? { workspaceId } : undefined

    const deployResult = await deployChanges(
      jsmTypesChanges,
      async change => {
        const typeDefinition = jsmApiDefinitions.types[getChangeData(change).elemID.typeName]
        const deployRequest = typeDefinition.deployRequests ? typeDefinition.deployRequests[change.action] : undefined
        const fieldsToIgnore = deployRequest?.fieldsToIgnore ?? []
        await defaultDeployChange({
          change,
          client,
          apiDefinitions: jsmApiDefinitions,
          fieldsToIgnore,
          additionalUrlVars,
        })
      }
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
