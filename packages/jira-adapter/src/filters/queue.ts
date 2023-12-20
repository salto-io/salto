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

import { Change, InstanceElement, getChangeData, isAdditionChange, isInstanceChange, isRemovalChange, toChange } from '@salto-io/adapter-api'
import { createSchemeGuard, getParent } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { elements as elementUtils } from '@salto-io/adapter-components'
import Joi from 'joi'
import { AdapterDuckTypeApiConfig } from '@salto-io/adapter-components/src/config'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'
import { QUEUE_TYPE } from '../constants'
import JiraClient from '../client/client'

const log = logger(module)
const { replaceInstanceTypeForDeploy } = elementUtils.ducktype

type QueueParams = {
  id: string
  name: string
}

type QueueGetResponse = {
  values: QueueParams[]
}
const QUEUE_RESOPNSE_SCHEME = Joi.object({
  values: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
  }).unknown(true)).required(),
}).unknown(true).required()

const isQueueResponse = createSchemeGuard<QueueGetResponse>(QUEUE_RESOPNSE_SCHEME)

const getExsitingQueuesNames = async (
  changes: Change<InstanceElement>[],
  client: JiraClient,
):Promise<(string | string)[][]> => {
  const firstQueueAdditionChange = changes.find(change => isAdditionChange(change)
  && change.data.after.elemID.typeName === QUEUE_TYPE)
  if (firstQueueAdditionChange === undefined) {
    return []
  }
  const instance = getChangeData(firstQueueAdditionChange)
  const parent = getParent(instance)
  const { serviceDeskId } = parent.value
  if (serviceDeskId === undefined) {
    log.error(`failed to deploy queue, because ${parent.value.name} does not have a service desk id`)
    return []
  }
  const response = await client.getSinglePage({
    url: `/rest/servicedeskapi/servicedesk/${serviceDeskId}/queue`,
  })
  if (!isQueueResponse(response.data)) {
    return []
  }
  const existingQueues = response.data.values.map(queue => [queue.name, queue.id])
  return existingQueues
}

const deployExistingQueue = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  existingQueues: Record<string, string>,
  jsmApiDefinitions: AdapterDuckTypeApiConfig
): Promise<void> => {
  if (!isAdditionChange(change)) {
    return
  }
  change.data.after.value.id = existingQueues[change.data.after.value.name]
  const emptyQueueInstance = change.data.after.clone()
  emptyQueueInstance.value = {}
  const modifyChange = toChange({ before: emptyQueueInstance, after: change.data.after })
  await defaultDeployChange({
    change: modifyChange,
    client,
    apiDefinitions: jsmApiDefinitions,
  })
}

const deployQueueRemovalChange = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const parent = getParent(getChangeData(change))
  const instanceId = getChangeData(change).value.id
  await client.put({
    url: `/rest/servicedesk/1/servicedesk/${parent.value.key}/queues`,
    data: { deleted: [instanceId] },
  })
}

/*
* This filter responsible for deploying queue deletions and deploying queues with default names.
* Modification change and addition non default named queues, will be deployed through the
* standard JSM deployment
*/
const filter: FilterCreator = ({ config, client }) => ({
  name: 'queueFilter',
  deploy: async changes => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const existingQueues: Record<string, string> = Object.fromEntries(
      await getExsitingQueuesNames(changes.filter(isInstanceChange), client)
    )

    const [queueChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
      && getChangeData(change).elemID.typeName === QUEUE_TYPE
      && (isRemovalChange(change) || Object.keys(existingQueues).includes(getChangeData(change).value.name))
    )

    const typeFixedChanges = queueChanges
      .map(change => ({
        action: change.action,
        data: _.mapValues(change.data, (instance: InstanceElement) =>
          replaceInstanceTypeForDeploy({
            instance,
            config: jsmApiDefinitions,
          })),
      })) as Change<InstanceElement>[]

    const deployResult = await deployChanges(typeFixedChanges.filter(isInstanceChange),
      async change => {
        if (isRemovalChange(change)) {
          return deployQueueRemovalChange(change, client)
        }
        return deployExistingQueue(change, client, existingQueues, jsmApiDefinitions)
      })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
