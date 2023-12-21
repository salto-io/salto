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
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { ReferenceExpression, Values } from '@salto-io/adapter-api'

export const JIRA_WORKFLOW_TYPE = 'JiraWorkflow'
export const CHUNK_SIZE = 25

export const WORKFLOW_FIELDS_TO_OMIT = [
  'isEditable',
  'scope',
]
export const WORKFLOW_ADDITION_FIELDS_TO_OMIT = [
  'id',
  'version',
]

export enum TASK_STATUS {
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  CANCELLED = 'CANCELLED',
  DEAD = 'DEAD',
}

export const STATUS_CATEGORY_ID_TO_KEY: Record<string, string> = {
  4: 'IN_PROGRESS',
  2: 'TODO',
  3: 'DONE',
}

type WorkflowIdResponse = {
  id: {
    entityId: string
  }
}

type WorkflowVersion = {
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

type Layout = {
  x: number
  y: number
}

export type WorkflowStatusLayout = {
  layout: Layout
  statusReference: ReferenceExpression
}

export type WorkflowStatus = {
  name: string
  id:string
  statusReference: string
}

export type TransitionStatusData = {
  statusReference: ReferenceExpression | string
  port: number
}

export type Transition = {
  to?: TransitionStatusData
  from?: TransitionStatusData[]
}

export type StatusMigration = {
  newStatusReference: ReferenceExpression | string
  oldStatusReference: ReferenceExpression | string
}

export type StatusMapping = {
  issueTypeId: string | ReferenceExpression
  projectId: string | ReferenceExpression
  statusMigrations: StatusMigration[]
}

type TASK_RESPONSE = {
  status: string
  progress: number
}

const TASK_RESPONSE_SCHEMA = Joi.object({
  status: Joi.string().required(),
  progress: Joi.number().required(),
}).unknown(true).required()

const STATUS_MAPPING_SCHEMA = Joi.array().items(
  Joi.object({
    issueTypeId: Joi.object().required(),
    projectId: Joi.object().required(),
    statusMigrations: Joi.array().items(Joi.object({
      newStatusReference: Joi.object().required(),
      oldStatusReference: Joi.object().required(),
    }).unknown(true).required()).required(),
  }).unknown(true).required()
).required()

const WORKFLOW_IDS_RESPONSE_SCHEMA = Joi.array().items(Joi.object({
  id: Joi.object({
    entityId: Joi.string().required(),
  }).unknown(true).required(),
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
  }).unknown(true)),
  taskId: Joi.string(),
}).unknown(true).required()

export const isWorkflowIdsResponse = createSchemeGuard<WorkflowIdResponse[]>(WORKFLOW_IDS_RESPONSE_SCHEMA, 'Received an invalid workflow ids response')

export const isWorkflowResponse = createSchemeGuard<WorkflowResponse>(WORKFLOW_RESPONSE_SCHEME, 'Received an invalid workflow response')

export const isStatusMappings = createSchemeGuard<StatusMapping[]>(STATUS_MAPPING_SCHEMA, 'Received an invalid statusMappings')

export const isTaskResponse = createSchemeGuard<TASK_RESPONSE>(TASK_RESPONSE_SCHEMA, 'Received an invalid task response')
