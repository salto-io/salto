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
import { logger } from '@salto-io/logging'
import { Change, DeployResult, InstanceElement, SaltoElementError, SaltoError, createSaltoElementError, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { FilterCreator } from '../../filter'
import { ASSETS_ATTRIBUTE_TYPE } from '../../constants'
import { getWorkspaceId } from '../../workspace_id'
import JiraClient from '../../client/client'

const log = logger(module)

const deployAttributeChanges = async ({
  jsmApiDefinitions,
  changes,
  client,
  workspaceId,
}: {
  jsmApiDefinitions: configUtils.AdapterDuckTypeApiConfig
  changes: Change<InstanceElement>[]
  client: JiraClient
  workspaceId: string
}): Promise<Omit<DeployResult, 'extraProperties'>> => {
  const additionalUrlVars = { workspaceId }
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

/* This filter deploys JSM attribute changes using two different endpoints. */
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
      changes.filter(isInstanceChange),
      change => isInstanceChange(change)
      && getChangeData(change).elemID.typeName === ASSETS_ATTRIBUTE_TYPE
    )

    const workspaceId = await getWorkspaceId(client)
    if (workspaceId === undefined) {
      log.error(`Skip deployment of ${ASSETS_ATTRIBUTE_TYPE} types because workspaceId is undefined`)
      const errors = attributesChanges.map(change => createSaltoElementError({
        message: 'workspaceId could not be found.',
        severity: 'Error',
        elemID: getChangeData(change).elemID,
      }))
      return {
        deployResult: { appliedChanges: [], errors },
        leftoverChanges,
      }
    }
    const deployResult = await deployAttributeChanges({
      jsmApiDefinitions,
      changes: attributesChanges,
      client,
      workspaceId,
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
