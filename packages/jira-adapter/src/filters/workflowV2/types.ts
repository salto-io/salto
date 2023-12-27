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

export const CHUNK_SIZE = 25

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


type WorkflowResponse = {
  workflows: Workflow[]
  taskId?: string
}

export type ConditionParameters = {
  accountIds?: string | string[]
  roleIds?: string | string[]
  groupIds?: string | string[]
  groupCustomFieldIds?: string | string[]
  allowUserCustomFieldIds?: string | string[]
  denyUserCustomFieldIds?: string | string[]
  statusIds?: string | string[]
}

export type Condition = {
  ruleKey: string
  parameters: ConditionParameters
  id: string
}


type TransitionConditions = {
  operation: string
  conditions?: Condition[]
}

export type Transition = {
  conditions?: TransitionConditions
}

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
