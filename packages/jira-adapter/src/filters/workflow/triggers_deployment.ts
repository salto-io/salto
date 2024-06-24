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
import { AdditionChange, getChangeData } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import JiraClient from '../../client/client'
import { WorkflowV1Instance } from './types'

const { awu } = collections.asynciterable

const log = logger(module)

export const deployTriggers = async (change: AdditionChange<WorkflowV1Instance>, client: JiraClient): Promise<void> => {
  const instance = getChangeData(change)

  const workflowName = instance.value.name
  // We never supposed to get here
  if (workflowName === undefined) {
    throw new Error('Cannot deploy a workflow without a name')
  }

  await awu(Object.values(instance.value.transitions) ?? []).forEach(async transition => {
    const transitionId = transition.id

    if (transitionId === undefined) {
      log.error(
        `Could not find the id of the transition ${transition.name} to deploy: ${safeJsonStringify(instance.value)}`,
      )
      throw new Error('Could not find the id of the transition to deploy')
    }

    await awu(transition.rules?.triggers ?? []).forEach(async trigger => {
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
