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
  isInstanceChange,
  isModificationChange,
  isRemovalChange,
  toChange,
} from '@salto-io/adapter-api'
import { createSchemeGuard, getParent } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
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
  values: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
      }).unknown(true),
    )
    .required(),
})
  .unknown(true)
  .required()

const isQueueResponse = createSchemeGuard<QueueGetResponse>(QUEUE_RESOPNSE_SCHEME)

const serviceIdSetterQueue = (
  instance: InstanceElement,
  serviceIdField: string,
  response: clientUtils.ResponseValue,
): void => {
  const serviceFieldValue = response?.[serviceIdField]
  if (instance.elemID.typeName === QUEUE_TYPE && _.isNumber(serviceFieldValue)) {
    instance.value[serviceIdField] = serviceFieldValue.toString()
  } else {
    instance.value[serviceIdField] = serviceFieldValue
  }
}

const getExsitingQueuesNamesAndIds = async (
  changes: Change<InstanceElement>[],
  client: JiraClient,
): Promise<string[][]> => {
  try {
    const parent = getParent(getChangeData(changes[0]))
    const response = await client.get({
      url: `/rest/servicedeskapi/servicedesk/projectId:${parent.value.id}/queue`,
    })
    if (!isQueueResponse(response.data)) {
      return []
    }
    const existingQueues = response.data.values.map(queue => [queue.name, queue.id])
    return existingQueues
  } catch (e) {
    log.error(`failed to get existing queues due to an error ${e}`)
    return []
  }
}

const updateDefaultQueue = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: JiraClient,
  existingQueues: Record<string, string>,
  jsmApiDefinitions: AdapterDuckTypeApiConfig,
): Promise<void> => {
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

const deployQueueRemovalChange = async (change: Change<InstanceElement>, client: JiraClient): Promise<void> => {
  const parent = getParent(getChangeData(change))
  const instanceId = getChangeData(change).value.id
  await client.put({
    url: `/rest/servicedesk/1/servicedesk/${parent.value.key}/queues`,
    data: { deleted: [instanceId] },
  })
}

const deployFavouriteValue = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const instance = getChangeData(change)
  const favoriteValue = instance.value.favourite
  const { id } = instance.value
  if (favoriteValue === true) {
    const data = {
      entity: {
        id,
        type: 'queues',
      },
      beforeEntityPosition: null,
    }
    await client.post({
      url: '/rest/internal/2/favourites',
      data,
    })
  } else {
    await client.delete({
      url: `/rest/internal/2/favourites/queues/${id}`,
    })
  }
}

/*
 * This filter responsible for deploying queue deletions and deploying queues with default names.
 * Modification change and addition non default named queues, will be deployed through the
 * standard JSM deployment
 */
const filter: FilterCreator = ({ config, client }) => ({
  name: 'queueDeploymentFilter',
  deploy: async changes => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const queueAdditionChanges = changes
      .filter(isAdditionChange)
      .filter(change => isInstanceChange(change))
      .filter(change => getChangeData(change).elemID.typeName === QUEUE_TYPE)

    const projectToQueueAdditions = _.groupBy(queueAdditionChanges, change => {
      try {
        const parent = getParent(getChangeData(change))
        return parent.elemID.getFullName()
      } catch (e) {
        log.error(`failed to get project name for change ${getChangeData(change).elemID.name} due to an error ${e}`)
        return ''
      }
    })
    const projectToExistiningQueues: Record<string, string[][]> = Object.fromEntries(
      await Promise.all(
        Object.entries(projectToQueueAdditions).map(async ([projectName, queueChanges]) => [
          projectName,
          await getExsitingQueuesNamesAndIds(queueChanges.filter(isInstanceChange), client),
        ]),
      ),
    )

    const [queueChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === QUEUE_TYPE,
    )

    const typeFixedChanges = queueChanges.map(change => ({
      action: change.action,
      data: _.mapValues(change.data, (instance: InstanceElement) =>
        replaceInstanceTypeForDeploy({
          instance,
          config: jsmApiDefinitions,
        }),
      ),
    })) as Change<InstanceElement>[]

    const deployResult = await deployChanges(typeFixedChanges.filter(isInstanceChange), async change => {
      if (isRemovalChange(change)) {
        return deployQueueRemovalChange(change, client)
      }
      const existingQueues = Object.fromEntries(
        projectToExistiningQueues[getParent(getChangeData(change)).elemID.getFullName()] ?? [],
      )
      if (isAdditionChange(change) && existingQueues[change.data.after.value.name] !== undefined) {
        await updateDefaultQueue(change, client, existingQueues, jsmApiDefinitions)
      } else {
        // deploy non default named queues (modification and addition)
        await defaultDeployChange({
          change,
          client,
          apiDefinitions: jsmApiDefinitions,
          serviceIdSetter: serviceIdSetterQueue,
        })
      }
      if (
        isAdditionChange(change) ||
        (isModificationChange(change) && change.data.before.value.favourite !== change.data.after.value.favourite)
      ) {
        await deployFavouriteValue(change, client)
      }
      return undefined
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
