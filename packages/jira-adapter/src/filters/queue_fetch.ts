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

import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import Joi from 'joi'
import _ from 'lodash'
import JiraClient from '../client/client'
import { QUEUE_TYPE } from '../constants'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

type QueueCatagoriesResponse = {
  id: number
  name: string
  canBeHidden: boolean
  favourite: boolean
}

type AllTicketResponse = {
  queues: QueueCatagoriesResponse[]
}

type QueuesCatagoriesResponse = {
  categories: AllTicketResponse[]
}

const QUEUES_CATAGORIES_RESPONSE_SCHEME = Joi.object({
  categories: Joi.array()
    .items(
      Joi.object({
        queues: Joi.array()
          .items(
            Joi.object({
              id: Joi.number().required(),
              name: Joi.string().required(),
              canBeHidden: Joi.boolean().required(),
              favourite: Joi.boolean().required(),
            }).unknown(true),
          )
          .required(),
      }).unknown(true),
    )
    .min(1) // Ensure that the array has at least one item
    .required(),
})
  .unknown(true)
  .required()

const isQueuesCatagoriesResponse = createSchemeGuard<QueuesCatagoriesResponse>(QUEUES_CATAGORIES_RESPONSE_SCHEME)

const fixJql = (input: string): string => {
  const firstProjectKeyPattern = /^project\s*=\s*\w+\s*AND\s*/i
  return input.replace(firstProjectKeyPattern, '').replace(/\btype\b/g, 'issuetype')
}

const addQueueStarAndPriority = async (
  projectKeysToQueues: Record<string, InstanceElement[]>,
  client: JiraClient,
): Promise<void> => {
  await awu(Object.entries(projectKeysToQueues)).forEach(async ([projectKey, queues]) => {
    const response = await client.get({
      url: `/rest/servicedesk/1/servicedesk/${projectKey}/queues/categories`,
    })
    if (!isQueuesCatagoriesResponse(response.data)) {
      return
    }
    const queuesCatagories = Object.fromEntries(
      response.data.categories[0].queues.map(queueDetails => [
        queueDetails.name,
        {
          canBeHidden: queueDetails.canBeHidden,
          favourite: queueDetails.favourite,
        },
      ]),
    )
    queues.forEach(queue => {
      queue.value.canBeHidden = queuesCatagories[queue.value.name].canBeHidden
      queue.value.favourite = queuesCatagories[queue.value.name].favourite
    })
  })
}

const filter: FilterCreator = ({ config, client }) => ({
  name: 'queueFetchFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    elements
      .filter(element => element.elemID.typeName === QUEUE_TYPE)
      .filter(isInstanceElement)
      .forEach(instance => {
        instance.value.columns = instance.value.fields
        delete instance.value.fields
        if (instance.value.jql) {
          instance.value.jql = fixJql(instance.value.jql)
        }
      })

    const projectKeysToQueues = _.groupBy(
      elements.filter(isInstanceElement).filter(instance => instance.elemID.typeName === QUEUE_TYPE),
      instance => instance.value.projectKey,
    )
    await addQueueStarAndPriority(projectKeysToQueues, client)
  },
})

export default filter
