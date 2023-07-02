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
import { AdditionChange, getChangeData } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import Joi from 'joi'
import _ from 'lodash'
import JiraClient from '../../client/client'
import { Transition, WorkflowInstance, WorkflowResponse, workflowSchema } from './types'

const { awu } = collections.asynciterable

const log = logger(module)

const isValidTransitionResponse = (response: unknown): response is { values: [WorkflowResponse] } => {
  const { error } = Joi.object({
    values: Joi.array().min(1).max(1).items(workflowSchema),
  }).unknown(true).required().validate(response)

  if (error !== undefined) {
    log.warn(`Unexpected workflows response from Jira: ${error}. ${safeJsonStringify(response)}`)
    return false
  }
  return true
}

const getTransitionsFromService = async (
  client: JiraClient,
  workflowName: string,
): Promise<Transition[]> => {
  const response = await client.getSinglePage({
    url: '/rest/api/3/workflow/search',
    queryParams: {
      expand: 'transitions',
      workflowName,
    },
  })

  if (!isValidTransitionResponse(response.data)) {
    return []
  }

  const workflowValues = response.data.values[0]
  return workflowValues.transitions ?? []
}

export const getTransitionKey = (transition: Transition): string => {
  const fromIds = _.sortBy(transition.from?.map(from => (
    typeof from === 'string' ? from : from.id
  )) ?? [])
  return [fromIds, transition.name ?? ''].join('-')
}

export const deployTriggers = async (
  change: AdditionChange<WorkflowInstance>,
  client: JiraClient
): Promise<void> => {
  const instance = getChangeData(change)

  const workflowName = instance.value.name
  // We never supposed to get here
  if (workflowName === undefined) {
    throw new Error('Cannot deploy a workflow without a name')
  }

  const transitions = await getTransitionsFromService(client, workflowName)
  const keyToTransition = _.keyBy(transitions, getTransitionKey)

  await awu(Object.values(instance.value.transitions) ?? []).forEach(async transition => {
    const transitionId = keyToTransition[getTransitionKey(transition)]?.id

    if (transitionId === undefined) {
      log.error(`Could not find the id of the transition ${transition.name} to deploy: ${safeJsonStringify(instance.value)}`)
      throw new Error('Could not find the id of the transition to deploy')
    }

    await awu(transition.rules?.triggers ?? [])
      .forEach(async trigger => {
        await client.putPrivate({
          url: '/rest/triggers/1.0/workflow/config',
          queryParams: {
            workflowName,
            actionId: transitionId,
          },
          data: {
            definitionConfig: trigger.configuration,
            triggerDefinitionKey: trigger.key,
          },
        })
      })
  })
}
