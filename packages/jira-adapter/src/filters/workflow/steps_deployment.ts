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
import { isReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import JiraClient from '../../client/client'
import { WorkflowInstance } from './types'

const { awu } = collections.asynciterable

export const deploySteps = async (
  instance: WorkflowInstance,
  client: JiraClient
): Promise<void> => {
  const statuses = instance.value.statuses ?? []

  const workflowName = instance.value.name

  if (workflowName === undefined) {
    throw new Error(`Workflow name is missing from ${instance.elemID.getFullName()}`)
  }

  await awu(statuses)
    .filter(status => !isReferenceExpression(status.id)
      || status.name !== status.id.value.value.name)
    .forEach(async status => {
      if (status.name === undefined) {
        throw new Error(`status name is missing in ${instance.elemID.getFullName()}`)
      }

      const statusId = isReferenceExpression(status.id) ? status.id.value.value.id : status.id
      if (statusId === undefined) {
        throw new Error(`status id is missing for ${status.name} in ${instance.elemID.getFullName()}`)
      }

      const stepId = instance.value.stepIds?.[statusId]
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
