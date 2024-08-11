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
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  toChange,
} from '@salto-io/adapter-api'
import { createSchemeGuard, getParent, hasValidParent } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { elements as elementUtils, config as configDeprecated } from '@salto-io/adapter-components'
import Joi from 'joi'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'
import { SLA_TYPE_NAME } from '../constants'
import JiraClient from '../client/client'

const log = logger(module)
const { replaceInstanceTypeForDeploy } = elementUtils.ducktype

type SlaParams = {
  id: number
  name: string
}

type SlaGetResponse = {
  timeMetrics: SlaParams[]
}
const SLA_RESPONSE_SCHEME = Joi.object({
  timeMetrics: Joi.array()
    .items(
      Joi.object({
        id: Joi.number().required(),
        name: Joi.string().required(),
      }).unknown(true),
    )
    .required(),
})
  .unknown(true)
  .required()

const isSlaResponse = createSchemeGuard<SlaGetResponse>(SLA_RESPONSE_SCHEME, 'Received invalid SLA response')

const getExistingSlaNamesAndIds = async (parent: InstanceElement, client: JiraClient): Promise<SlaParams[]> => {
  try {
    const response = await client.get({
      url: `/rest/servicedesk/1/servicedesk/agent/${parent.value.key}/sla/metrics`,
    })
    if (!isSlaResponse(response.data)) {
      return []
    }
    const existingSlas = response.data.timeMetrics.map(({ name, id }) => ({ name, id }))
    return existingSlas
  } catch (e) {
    log.error(`failed to get existing Slas due to an error ${e}`)
    return []
  }
}

const updateDefaultSla = async (
  change: AdditionChange<InstanceElement>,
  client: JiraClient,
  serviceId: number,
  jsmApiDefinitions: configDeprecated.AdapterDuckTypeApiConfig,
): Promise<void> => {
  change.data.after.value.id = serviceId
  const emptySlaInstance = change.data.after.clone()
  emptySlaInstance.value = {}
  const modifyChange = toChange({ before: emptySlaInstance, after: change.data.after })
  await defaultDeployChange({
    change: modifyChange,
    client,
    apiDefinitions: jsmApiDefinitions,
  })
}

/*
 * This filter responsible for deploying slas with default names.
 * all other sla, will be deployed through the standard JSM deployment.
 */
const filter: FilterCreator = ({ config, client }) => ({
  name: 'slaAdditionFilter',
  deploy: async changes => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const [slaAdditionChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isAdditionChange(change) && isInstanceChange(change) && getChangeData(change).elemID.typeName === SLA_TYPE_NAME,
    )

    if (slaAdditionChanges.length === 0) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const projectsWithSlaAdditions = new Set(
      slaAdditionChanges
        .map(change => getChangeData(change))
        .filter(instance => hasValidParent(instance))
        .map(instance => getParent(instance)),
    )

    const projectToServiceSlas: Record<string, SlaParams[]> = Object.fromEntries(
      await Promise.all(
        Array.from(projectsWithSlaAdditions).map(async project => [
          project.elemID.getFullName(),
          await getExistingSlaNamesAndIds(project, client),
        ]),
      ),
    )
    const typeFixedChanges = slaAdditionChanges.map(change => ({
      action: change.action,
      data: _.mapValues(change.data, (instance: InstanceElement) =>
        replaceInstanceTypeForDeploy({
          instance,
          config: jsmApiDefinitions,
        }),
      ),
    })) as Change<InstanceElement>[]

    const deployResult = await deployChanges(
      typeFixedChanges.filter(isInstanceChange).filter(isAdditionChange),
      async change => {
        const serviceSLA = _.keyBy(
          projectToServiceSlas[getParent(getChangeData(change)).elemID.getFullName()] ?? [],
          'name',
        )[change.data.after.value.name]
        if (serviceSLA === undefined || serviceSLA.id === undefined) {
          await defaultDeployChange({
            change,
            client,
            apiDefinitions: jsmApiDefinitions,
          })
        } else {
          await updateDefaultSla(change, client, serviceSLA.id, jsmApiDefinitions)
        }
      },
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
