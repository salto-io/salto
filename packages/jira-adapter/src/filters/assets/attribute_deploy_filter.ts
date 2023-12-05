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

import { config as configUtils } from '@salto-io/adapter-components'
import { Change, DeployResult, InstanceElement, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { FilterCreator } from '../../filter'
import { ASSETS_ATTRIBUTE_TYPE } from '../../constants'
import { getWorkspaceId } from '../../workspace_id'
import JiraClient from '../../client/client'


const deployAttributeChanges = async (
  jsmApiDefinitions: configUtils.AdapterDuckTypeApiConfig,
  changes: Change<InstanceElement>[],
  client: JiraClient):
  Promise<Omit<DeployResult, 'extraProperties'>> => {
  const workspaceId = await getWorkspaceId(client)
  const additionalUrlVars = workspaceId ? { workspaceId } : undefined
  return deployChanges(
    changes,
    async change => {
      const instance = getChangeData(change)
      await defaultDeployChange({
        change,
        client,
        apiDefinitions: jsmApiDefinitions,
        additionalUrlVars,
      })
      if (isAdditionOrModificationChange(change)) {
        const data = _.omit(instance.value, ['objectType', 'typeValue'])
        const url = `gateway/api/jsm/assets/workspace/${workspaceId}/v1/objecttypeattribute/${instance.value.id}/configure`
        await client.put({
          url,
          data,
        })
      }
    }
  )
}

const filter: FilterCreator = ({ config, client }) => ({
  name: 'deployAttributesFilter',
  deploy: async changes => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || !config.fetch.enableJsmExperimental || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const [attributesChanges, leftoverChanges] = _.partition(
      changes,
      (change): change is Change<InstanceElement> => isInstanceChange(change)
      && getChangeData(change).elemID.typeName === ASSETS_ATTRIBUTE_TYPE
    )
    const deployResult = await deployAttributeChanges(jsmApiDefinitions, attributesChanges, client)

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
