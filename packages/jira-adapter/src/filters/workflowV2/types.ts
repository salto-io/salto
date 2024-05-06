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
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import {
  AdditionChange,
  Change,
  InstanceElement,
  ModificationChange,
  Values,
  isAdditionOrModificationChange,
  isInstanceChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { WORKFLOW_CONFIGURATION_TYPE } from '../../constants'
import { WorkflowV1Instance, isWorkflowV1Instance } from '../workflow/types'

export const CHUNK_SIZE = 25
export const TRANSITION_LIST_FIELDS = new Set([
  'statusIds',
  'groupsExemptFromValidation',
  'fieldsRequired',
  'enabledTriggers',
  'roleIds',
  'groupIds',
])
export const ID_TO_UUID_PATH_NAME_TO_RECURSE = new Set([
  'statuses',
  'transitions',
  'statusMappings',
  'statusMigrations',
])
export const CONDITION_GROUPS_PATH_NAME_TO_RECURSE = new Set(['transitions', 'conditions', 'conditionGroups'])
export const EMPTY_STRINGS_PATH_NAME_TO_RECURSE = new Set([
  'transitions',
  'conditions',
  'conditionGroups',
  'validators',
  'actions',
  'triggers',
])

export enum TASK_STATUS {
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  CANCELLED = 'CANCELLED',
  DEAD = 'DEAD',
  RUNNING = 'RUNNING',
  ENQUEUED = 'ENQUEUED',
}

export const STATUS_CATEGORY_ID_TO_KEY: Record<number, string> = {
  4: 'IN_PROGRESS',
  2: 'TODO',
  3: 'DONE',
}

export type WorkflowStatus = {
  id: string
  name: string
}

export type PayloadWorkflowStatus = WorkflowStatus & {
  statusReference: string
}

export type WorkflowStatusAndPort = {
  statusReference: string | ReferenceExpression
  port?: number
}

export type WorkflowTransitionV2 = {
  id?: string
  type: string
  name: string
  from?: WorkflowStatusAndPort[]
  to?: WorkflowStatusAndPort
  actions?: Values[]
  conditions?: Values
  validators?: Values[]
}

type WorkflowDataResponse = {
  id: {
    entityId: string
  }
  statuses: WorkflowStatus[]
}

export type WorkflowVersion = {
  versionNumber: number
  id: string
}

type WorkflowScope = {
  project: string
  type: string
}

export type Workflow = {
  name: string
  version?: WorkflowVersion
  scope: WorkflowScope
  id?: string
  transitions: WorkflowTransitionV2[]
  statuses: Values[]
}

export type WorkflowV2Instance = InstanceElement & {
  value: InstanceElement['value'] &
    Omit<Workflow, 'transitions'> & { transitions: Record<string, WorkflowTransitionV2> }
}

const TRANSITION_SCHEME = Joi.object({
  id: Joi.string(),
  actions: Joi.array().items(Joi.object()),
  type: Joi.string().required(),
  name: Joi.string().required(),
  from: Joi.array().items(
    Joi.object({
      statusReference: Joi.alternatives(Joi.object(), Joi.string()).required(),
      port: Joi.number(),
    }),
  ),
  to: Joi.object({
    statusReference: Joi.alternatives(Joi.object(), Joi.string()).required(),
    port: Joi.number(),
  }),
  conditions: Joi.object(),
  validators: Joi.array().items(Joi.object()),
})
  .unknown(true)
  .required()

const WORKFLOW_SCHEMA = Joi.object({
  name: Joi.string().required(),
  version: Joi.object({
    versionNumber: Joi.number().required(),
    id: Joi.string().required(),
  }).unknown(true),
  scope: Joi.object({
    project: Joi.string(),
    type: Joi.string().required(),
  })
    .unknown(true)
    .required(),
  id: Joi.string(),
  transitions: Joi.object().pattern(Joi.string(), TRANSITION_SCHEME).required(),
  statuses: Joi.array().items(Joi.object()).required(),
})
  .unknown(true)
  .required()

const isWorkflowValues = createSchemeGuard<Workflow & { transitions: Record<string, WorkflowTransitionV2> }>(
  WORKFLOW_SCHEMA,
  'Received an invalid workflow values',
)

export const isWorkflowV2Instance = (instance: InstanceElement): instance is WorkflowV2Instance =>
  instance.elemID.typeName === WORKFLOW_CONFIGURATION_TYPE && isWorkflowValues(instance.value)

export const isWorkflowInstance = (instance: InstanceElement): instance is WorkflowV1Instance | WorkflowV2Instance =>
  isWorkflowV1Instance(instance) || isWorkflowV2Instance(instance)

type DeploymentWorkflowPayload = {
  statuses: PayloadWorkflowStatus[]
  workflows: Workflow[]
  scope?: WorkflowScope
}

type WorkflowResponse = {
  workflows: (Workflow & { version: WorkflowVersion })[]
  statuses: PayloadWorkflowStatus[]
  taskId?: string
}

type TaskResponse = {
  status: string
  progress: number
}

export const isAdditionOrModificationWorkflowChange = (
  change: Change,
): change is AdditionChange<InstanceElement> | ModificationChange<InstanceElement> =>
  isInstanceChange(change) &&
  isAdditionOrModificationChange(change) &&
  change.data.after.elemID.typeName === WORKFLOW_CONFIGURATION_TYPE

const TASK_RESPONSE_SCHEMA = Joi.object({
  status: Joi.string().required(),
  progress: Joi.number().required(),
})
  .unknown(true)
  .required()

const WORKFLOW_DATA_RESPONSE_SCHEMA = Joi.array()
  .items(
    Joi.object({
      id: Joi.object({
        entityId: Joi.string().required(),
      })
        .unknown(true)
        .required(),
      statuses: Joi.array()
        .items(
          Joi.object({
            id: Joi.string().required(),
            name: Joi.string().required(),
          })
            .unknown(true)
            .required(),
        )
        .required(),
    })
      .unknown(true)
      .required(),
  )
  .required()

const WORKFLOW_SCHEME = Joi.object({
  name: Joi.string().required(),
  id: Joi.string(),
  version: Joi.object({
    versionNumber: Joi.number().required(),
    id: Joi.string().required(),
  }).unknown(true),
  scope: Joi.object({
    project: Joi.string(),
    type: Joi.string().required(),
  })
    .unknown(true)
    .required(),
  statuses: Joi.array().items(Joi.object().unknown(true)).required(),
  transitions: Joi.array().items(TRANSITION_SCHEME).required(),
})
  .unknown(true)
  .required()

const STATUSES_SCHEME = Joi.array()
  .items(
    Joi.object({
      id: Joi.string().required(),
      name: Joi.string().required(),
      statusReference: Joi.string().required(),
    })
      .unknown(true)
      .required(),
  )
  .required()

const WORKFLOW_RESPONSE_SCHEME = Joi.object({
  workflows: Joi.array()
    .items(
      WORKFLOW_SCHEME.concat(
        Joi.object({
          version: Joi.object({
            versionNumber: Joi.number().required(),
            id: Joi.string().required(),
          })
            .unknown(true)
            .required(),
        }),
      ),
    )
    .required(),
  statuses: STATUSES_SCHEME,
  taskId: Joi.string(),
})
  .unknown(true)
  .required()

const DEPLOYMENT_WORKFLOW_PAYLOAD_SCHEME = Joi.object({
  statuses: STATUSES_SCHEME,
  workflows: Joi.array().items(WORKFLOW_SCHEME).required(),
  scope: Joi.object({
    project: Joi.string(),
    type: Joi.string().required(),
  }).unknown(true),
})
  .unknown(true)
  .required()

export const isDeploymentWorkflowPayload = createSchemeGuard<DeploymentWorkflowPayload>(
  DEPLOYMENT_WORKFLOW_PAYLOAD_SCHEME,
  'Received an invalid workflow payload',
)

export const isWorkflowDataResponse = createSchemeGuard<WorkflowDataResponse[]>(
  WORKFLOW_DATA_RESPONSE_SCHEMA,
  'Received an invalid workflow ids response',
)

export const isWorkflowResponse = createSchemeGuard<WorkflowResponse>(
  WORKFLOW_RESPONSE_SCHEME,
  'Received an invalid workflow response',
)

export const isTaskResponse = createSchemeGuard<TaskResponse>(TASK_RESPONSE_SCHEMA, 'Received an invalid task response')
