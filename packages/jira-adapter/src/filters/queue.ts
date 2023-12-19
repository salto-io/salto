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

import { Change, InstanceElement, getChangeData, isAdditionChange, isInstanceChange, isRemovalChange } from '@salto-io/adapter-api'
import { createSchemeGuard, getParent, resolveChangeElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { elements as elementUtils } from '@salto-io/adapter-components'
import Joi from 'joi'
import { deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'
import { QUEUE_TYPE } from '../constants'
import { getLookUpName } from '../reference_mapping'
import JiraClient from '../client/client'

const { replaceInstanceTypeForDeploy } = elementUtils.ducktype
const { awu } = collections.asynciterable
type queueGetRsponse = {
  values: {
    id: string
    name: string
  }[]
}
const QUEUE_RESOPNSE_SCHEME = Joi.object({
  values: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
  }).unknown(true)).required(),
}).unknown(true).required()

const isQueueResponse = createSchemeGuard<queueGetRsponse>(QUEUE_RESOPNSE_SCHEME)

const isDefaultNameAddition = async (
  change: Change<InstanceElement>,
  client: JiraClient,
):Promise<boolean> => {
  const instance = getChangeData(change)
  const parent = getParent(instance)
  const { serviceDeskId } = parent.value
  if (serviceDeskId === undefined) {
    throw new Error(`failed to deploy queue, because ${parent.value.name} does not have a service desk id`)
  }
  const response = await client.getSinglePage({
    url: `/rest/servicedeskapi/servicedesk/${serviceDeskId}/queue`,
  })
  if (!isQueueResponse(response.data)) {
    return false
  }
  const existingQueuesNames = response.data.values.map(queue => queue.name)
  return existingQueuesNames.includes(instance.value.name)
}

const deployExistingQueue = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  if (isRemovalChange(change)) {
    return
  }
  const instance = getChangeData(change)
  const parent = getParent(instance)
  const response = await client.getSinglePage({
    url: `/rest/servicedeskapi/servicedesk/${parent.value.serviceDeskId}/queue`,
  })
  if (!isQueueResponse(response.data)) {
    return
  }
  const queueId = response.data.values.find(queue => queue.name === instance.value.name)?.id
  if (queueId === undefined) {
    throw new Error(`failed to deploy queue, because ${instance.value.name} does not have id`)
  }
  const resolvedChange = await resolveChangeElement(change, getLookUpName)
  await client.put({
    url: `/rest/servicedesk/1/servicedesk/${parent.value.key}/queues/${queueId}`,
    data: resolvedChange.data.after.value,
  })
  instance.value.id = queueId
}

const deployQueueRemovalChange = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  if (!isRemovalChange(change)) {
    return
  }
  const parent = getParent(getChangeData(change))
  const instanceId = getChangeData(change).value.id
  await client.put({
    url: `/rest/servicedesk/1/servicedesk/${parent.value.key}/queues`,
    data: { deleted: [instanceId] },
  })
}

/* This filter responsible for deploying queue deletions and deploying queues with default names.
* Modification change and addition non default named queues, will be deployed through the
* standard JSM deployment */
const filter: FilterCreator = ({ config, client }) => ({
  name: 'queue',
  deploy: async changes => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const relevantQueueAdditions = await awu(changes)
      .filter(change => isAdditionChange(change))
      .filter(change => getChangeData(change).elemID.typeName === QUEUE_TYPE)
      .filter(change => isInstanceChange(change))
      .filter(async change => isDefaultNameAddition(change as Change<InstanceElement>, client))
      .toArray()


    const [queueChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
      && getChangeData(change).elemID.typeName === QUEUE_TYPE
      && (isRemovalChange(change) || relevantQueueAdditions.includes(change))
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
        await deployQueueRemovalChange(change, client)
        await deployExistingQueue(change, client)
      })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
