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
import { AdditionChange, getChangeData } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import JiraClient from '../../client/client'
import { getTransitionKey } from './transition_ids_filter'
import { WorkflowInstance } from './types'

const { awu } = collections.asynciterable

export const deployTriggers = async (
  change: AdditionChange<WorkflowInstance>,
  client: JiraClient
): Promise<void> => {
  const instance = getChangeData(change)

  await awu(instance.value.transitions ?? []).forEach(async transition => {
    const transitionId = instance.value.transitionIds?.[getTransitionKey(transition)]

    await awu(transition.rules?.triggers ?? [])
      .forEach(async trigger => {
        await client.putPrivate({
          url: '/rest/triggers/1.0/workflow/config',
          queryParams: {
            workflowName: instance.value.name as string,
            actionId: transitionId as string,
          },
          data: {
            definitionConfig: trigger.configuration,
            triggerDefinitionKey: trigger.key,
          },
        })
      })
  })
}
