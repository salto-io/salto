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
import { AdditionChange, Change, InstanceElement, ModificationChange, Values, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { JIRA_WORKFLOW_TYPE } from '../../constants'

export const CHUNK_SIZE = 25
export const VALIDATOR_LIST_FIELDS = new Set(['statusIds', 'groupsExemptFromValidation', 'fieldsRequired'])
export const CONDITION_LIST_FIELDS = new Set(['roleIds', 'groupIds', 'statusIds'])
export const ID_TO_UUID_PATH_NAME_TO_RECURSE = new Set(['statuses', 'transitions', 'statusMappings', 'statusMigrations'])
export const CONDITION_GROUPS_PATH_NAME_TO_RECURSE = new Set(['transitions', 'conditions', 'conditionGroups'])

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

export type Status = {
  id: string
  name: string
}

type WorkflowDataResponse = {
  id: {
    entityId: string
  }
  statuses: Status[]
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
  version: WorkflowVersion
  scope: WorkflowScope
  id: string
  transitions: Values[]
  statuses: Values[]
}

export type WorkflowPayload = {
  statuses: Values[]
  workflows: Values[]
  scope?: WorkflowScope
}

type WorkflowResponse = {
  workflows: Workflow[]
  taskId?: string
}

type TaskResponse = {
  status: string
  progress: number
}

export const isAdditionOrModificationWorkflowChange = (
  change: Change
): change is AdditionChange<InstanceElement> | ModificationChange<InstanceElement> =>
  isInstanceChange(change)
  && isAdditionOrModificationChange(change)
  && change.data.after.elemID.typeName === JIRA_WORKFLOW_TYPE

const TASK_RESPONSE_SCHEMA = Joi.object({
  status: Joi.string().required(),
  progress: Joi.number().required(),
}).unknown(true).required()

const WORKFLOW_DATA_RESPONSE_SCHEMA = Joi.array().items(Joi.object({
  id: Joi.object({
    entityId: Joi.string().required(),
  }).unknown(true).required(),
  statuses: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
  }).unknown(true).required()).required(),
}).unknown(true).required()).required()


const WORKFLOW_RESPONSE_SCHEME = Joi.object({
  workflows: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    id: Joi.string().required(),
    version: Joi.object({
      versionNumber: Joi.number().required(),
      id: Joi.string().required(),
    }).unknown(true).required(),
    scope: Joi.object({
      project: Joi.string(),
      type: Joi.string().required(),
    }).unknown(true).required(),
    statuses: Joi.array().items(Joi.object()
      .unknown(true)).required(),
    transitions: Joi.array().items(Joi.object()
      .unknown(true)).required(),
  }).unknown(true)).required(),
  taskId: Joi.string(),
}).unknown(true).required()

export const isWorkflowDataResponse = createSchemeGuard<WorkflowDataResponse[]>(WORKFLOW_DATA_RESPONSE_SCHEMA, 'Received an invalid workflow ids response')

export const isWorkflowResponse = createSchemeGuard<WorkflowResponse>(WORKFLOW_RESPONSE_SCHEME, 'Received an invalid workflow response')

export const isTaskResponse = createSchemeGuard<TaskResponse>(TASK_RESPONSE_SCHEMA, 'Received an invalid task response')
