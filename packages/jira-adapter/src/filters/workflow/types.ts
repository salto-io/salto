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
import { Change, getChangeData, InstanceElement, isInstanceChange, Values, Element } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { WORKFLOW_TYPE_NAME } from '../../constants'

const log = logger(module)

type Id = {
  name?: string
  entityId?: string
}

const idSchema = Joi.object({
  name: Joi.string().optional(),
  entityId: Joi.string().optional(),
}).unknown(true)

type ConfigRef = {
  id?: unknown
  name?: string
}

const configRefSchema = Joi.object({
  id: Joi.optional(),
  name: Joi.string().optional(),
}).unknown(true)

type ValidatorConfiguration = {
  windowsDays?: number | string
  fieldId?: unknown
  parentStatuses?: ConfigRef[]
  previousStatus?: ConfigRef
  field?: string
  fields?: string[]
  fieldIds?: unknown[]
  id?: unknown
}

const validatorConfigurationSchema = Joi.object({
  windowsDays: Joi.alternatives(
    Joi.number().integer(),
    Joi.string(),
  ).optional(),
  fieldId: Joi.optional(),
  parentStatuses: Joi.array().items(configRefSchema).optional(),
  previousStatus: configRefSchema.optional(),
  field: Joi.optional(),
  fields: Joi.array().items(Joi.string()).optional(),
  fieldIds: Joi.array().optional(),
}).unknown(true)

type PostFunctionConfiguration = {
  projectRole?: ConfigRef
  event?: ConfigRef
  id?: unknown
}

const postFunctionConfigurationSchema = Joi.object({
  projectRole: configRefSchema.optional(),
  event: configRefSchema.optional(),
}).unknown(true)

export type Validator = {
  type?: string
  configuration?: ValidatorConfiguration
}

const validatorSchema = Joi.object({
  type: Joi.string().optional(),
  configuration: validatorConfigurationSchema.optional(),
}).unknown(true)

export type PostFunction = {
  type?: string
  configuration?: PostFunctionConfiguration
}

const postFunctionSchema = Joi.object({
  type: Joi.string().optional(),
  configuration: postFunctionConfigurationSchema.optional(),
}).unknown(true)

export type Trigger = {
  key?: string
  configuration?: Record<string, unknown>
}

export const triggerSchema = Joi.object({
  key: Joi.string().optional(),
  configuration: Joi.object().optional(),
}).unknown(true)

export type Condition = {
  conditions?: Condition[]
  type?: string
  configuration?: Record<string, unknown>
}

const conditionScheme = Joi.object({
  conditions: Joi.array().items(Joi.link('/')).optional(),
  type: Joi.string().optional(),
  configuration: Joi.object().optional(),
}).unknown(true)

export type Rules = {
  validators?: Validator[]
  postFunctions?: PostFunction[]
  triggers?: Trigger[]
  conditionsTree?: Condition
  conditions?: Condition
}

const rulesSchema = Joi.object({
  validators: Joi.array().items(validatorSchema).optional(),
  postFunctions: Joi.array().items(postFunctionSchema).optional(),
  triggers: Joi.array().items(triggerSchema).optional(),
  conditionsTree: conditionScheme.optional(),
  conditions: conditionScheme.optional(),
}).unknown(true)

export type Transition = {
  id?: string
  type?: string
  rules?: Rules
  name?: string
  from?: unknown[]
  properties?: Values
}

const transitionsSchema = Joi.object({
  id: Joi.string().optional(),
  type: Joi.string().optional(),
  rules: rulesSchema.optional(),
  name: Joi.string().optional(),
  from: Joi.array().items(Joi.any()).optional(),
  properties: Joi.alternatives(Joi.object(), Joi.array()).optional(),
}).unknown(true)

export type Status = {
  id?: unknown
  name?: string
  properties?: Values
}

const statusSchema = Joi.object({
  id: Joi.optional(),
  name: Joi.string().optional(),
  properties: Joi.alternatives(Joi.object(), Joi.array()).optional(),
}).unknown(true)

export type Workflow = {
  id?: Id
  entityId?: string
  name?: string
  transitions?: Transition[]
  statuses?: Status[]
}

export const workflowSchema = Joi.object({
  id: idSchema.optional(),
  entityId: Joi.string().optional(),
  name: Joi.string().optional(),
  transitions: Joi.array().items(transitionsSchema).optional(),
  statuses: Joi.array().items(statusSchema).optional(),
}).unknown(true).required()

export type WorkflowInstance = InstanceElement & { value: InstanceElement['value'] & Workflow }

export const isWorkflowValues = (values: unknown): values is Workflow => {
  const { error } = workflowSchema.validate(values)
  if (error !== undefined) {
    log.warn(`Received an invalid workflow: ${error.message}`)
    return false
  }
  return true
}

export const isWorkflowInstance = (instance: InstanceElement)
: instance is WorkflowInstance =>
  instance.elemID.typeName === WORKFLOW_TYPE_NAME && isWorkflowValues(instance.value)


export type PostFetchWorkflow = Workflow & {
  name: string
}

export type PostFetchWorkflowInstance = WorkflowInstance & { value: WorkflowInstance['value'] & PostFetchWorkflow }

export const isPostFetchWorkflowInstance = (instance: InstanceElement)
: instance is PostFetchWorkflowInstance => isWorkflowValues(instance.value)
  && instance.value.name !== undefined

export const getWorkflowChanges = (changes: Change<Element>[]): Change<WorkflowInstance>[] => changes
  .filter(isInstanceChange)
  .filter(change => isWorkflowInstance(getChangeData(change)))
