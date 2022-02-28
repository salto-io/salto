/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, CORE_ANNOTATIONS, Element, Field, isInstanceElement, MapType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { WORKFLOW_TYPE_NAME } from '../../constants'
import { isWorkflowInstance, WorkflowInstance } from './types'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config'

const log = logger(module)

type StatusesResponse = {
  layout: {
    statuses: {
      stepId: number
      statusId?: string
    }[]
  }
}

const isValidStatusesResponse = (response: unknown): response is StatusesResponse => {
  const { error } = Joi.object({
    layout: Joi.object({
      statuses: Joi.array().items(Joi.object({
        stepId: Joi.number().required(),
        statusId: Joi.number(),
      }).unknown(true)),
    }).unknown(true).required(),
  }).unknown(true).required().validate(response)

  if (error !== undefined) {
    log.error(`Received invalid statuses response from Jira: ${error}. ${safeJsonStringify(response)}`)
    return false
  }
  return true
}

export const addStepIds = async (
  instance: WorkflowInstance,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  if (!config.client.usePrivateAPI) {
    log.debug('Skipping stepIds filter because Jira is not configured to use private API')
    return
  }

  if (instance.value.name === undefined) {
    log.error(`Received a workflow ${instance.elemID.getFullName()} without a name. ${safeJsonStringify(instance.value)}`)
    return
  }

  const response = await client.getPrivate({
    url: 'rest/workflowDesigner/1.0/workflows',
    queryParams: {
      name: instance.value.name,
    },
  })

  if (!isValidStatusesResponse(response.data)) {
    return
  }

  instance.value.stepIds = Object.fromEntries(
    response.data.layout.statuses
      .filter(({ statusId }) => statusId !== undefined)
      .map(status => [status.statusId, status.stepId.toString()])
  )
}

const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    const workflowType = findObject(elements, WORKFLOW_TYPE_NAME)
    if (workflowType === undefined) {
      log.warn(`${WORKFLOW_TYPE_NAME} type not found`)
    } else {
      workflowType.fields.stepIds = new Field(
        workflowType,
        'stepIds',
        new MapType(BuiltinTypes.STRING),
        { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true }
      )
    }

    await Promise.all(elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .filter(isWorkflowInstance)
      .map(instance => addStepIds(instance, client, config)))
  },
})

export default filter
