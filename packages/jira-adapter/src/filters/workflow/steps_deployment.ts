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
import { isResolvedReferenceExpression, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import Joi from 'joi'
import JiraClient from '../../client/client'
import { WorkflowV1Instance } from './types'

const { awu } = collections.asynciterable

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
      statuses: Joi.array().items(
        Joi.object({
          stepId: Joi.number().required(),
          statusId: Joi.number(),
        }).unknown(true),
      ),
    })
      .unknown(true)
      .required(),
  })
    .unknown(true)
    .required()
    .validate(response)

  if (error !== undefined) {
    log.error(`Received invalid statuses response from Jira: ${error}. ${safeJsonStringify(response)}`)
    return false
  }
  return true
}

const getStatusIdToStepId = async (workflowName: string, client: JiraClient): Promise<Record<string, string>> => {
  const response = await client.getPrivate({
    url: '/rest/workflowDesigner/1.0/workflows',
    queryParams: {
      name: workflowName,
    },
  })

  if (!isValidStatusesResponse(response.data)) {
    throw new Error(`Failed to get step ids for workflow ${workflowName}`)
  }

  return Object.fromEntries(
    response.data.layout.statuses
      .filter(({ statusId }) => statusId !== undefined)
      .map(status => [status.statusId, status.stepId.toString()]),
  )
}

export const deploySteps = async (instance: WorkflowV1Instance, client: JiraClient): Promise<void> => {
  const statuses = instance.value.statuses ?? []

  const workflowName = instance.value.name

  if (workflowName === undefined) {
    throw new Error(`Workflow name is missing from ${instance.elemID.getFullName()}`)
  }

  const statusIdToStepId = await getStatusIdToStepId(workflowName, client)

  await awu(statuses)
    .filter(status => !isResolvedReferenceExpression(status.id) || status.name !== status.id.value.value.name)
    .forEach(async status => {
      if (status.name === undefined) {
        throw new Error(`status name is missing in ${instance.elemID.getFullName()}`)
      }

      const statusId = isResolvedReferenceExpression(status.id) ? status.id.value.value.id : status.id
      if (statusId === undefined) {
        throw new Error(`status id is missing for ${status.name} in ${instance.elemID.getFullName()}`)
      }

      const stepId = statusIdToStepId[statusId]
      if (stepId === undefined) {
        throw new Error(`step id is missing for ${status.name} in ${instance.elemID.getFullName()}`)
      }

      await client.jspPost({
        url: '/secure/admin/workflows/EditWorkflowStep.jspa',
        data: {
          stepName: status.name,
          workflowStep: stepId,
          stepStatus: statusId,
          workflowName,
          workflowMode: 'live',
        },
      })
    })
}
