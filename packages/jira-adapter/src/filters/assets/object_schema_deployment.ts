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

import {
  AdditionChange,
  Change,
  InstanceElement,
  ModificationChange,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isEqualValues,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../../filter'
import { OBJECT_SCHEMA_TYPE } from '../../constants'
import { deployChanges, defaultDeployChange } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'
import { getWorkspaceId } from '../../workspace_id'

const { replaceInstanceTypeForDeploy } = elementUtils.ducktype

const FIELDS_TO_IGNORE = ['issueView', 'requestForm', 'workflowStatuses', 'avatarId', 'groupIds']

const deployProperties = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const instance = getChangeData(change)
  const url = `/gateway/api/jsm/assets/workspace/${instance.value.workspaceId}/v1/global/config/objectschema/${instance.value.id}/property`
  if (
    isAdditionChange(change) ||
    !isEqualValues(change.data.before.value.properties, change.data.after.value.properties)
  ) {
    await client.post({
      url,
      data: instance.value.properties,
    })
  }
}

/*
 * Deploy object schema filter. Using it because it needs to be deployed
 * through different API calls.
 */
const filter: FilterCreator = ({ config, client }) => ({
  name: 'objectSchemaDeployFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const { jsmApiDefinitions } = config
    if (
      !config.fetch.enableJSM ||
      !(config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium) ||
      jsmApiDefinitions === undefined
    ) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === OBJECT_SCHEMA_TYPE,
    )
    const typeFixedChanges = relevantChanges.map(change => ({
      action: change.action,
      data: _.mapValues(change.data, (instance: InstanceElement) =>
        replaceInstanceTypeForDeploy({
          instance,
          config: jsmApiDefinitions,
        }),
      ),
    })) as Change<InstanceElement>[]
    const workspaceId = await getWorkspaceId(client, config)
    const deployResult = await deployChanges(typeFixedChanges, async change => {
      if (isAdditionChange(change)) {
        getChangeData(change).value.workspaceId = workspaceId
      }
      await defaultDeployChange({
        change,
        client,
        apiDefinitions: jsmApiDefinitions,
        fieldsToIgnore: FIELDS_TO_IGNORE,
      })
      if (isAdditionOrModificationChange(change)) {
        await deployProperties(change, client)
      }
    })
    return { deployResult, leftoverChanges }
  },
})

export default filter
