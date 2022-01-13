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
import { InstanceElement, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Joi from 'joi'

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
  id?: string
  name?: string
}

const configRefSchema = Joi.object({
  id: Joi.string().optional(),
  name: Joi.string().optional(),
}).unknown(true)

type ValidatorConfiguration = {
  windowsDays?: number | string
  fieldId?: string
  parentStatuses?: ConfigRef[]
  previousStatus?: ConfigRef
  field?: string
  fields?: string[]
  fieldIds?: string[]
}

const validatorConfigurationSchema = Joi.object({
  windowsDays: Joi.alternatives(
    Joi.number().integer(),
    Joi.string(),
  ).optional(),
  fieldId: Joi.string().optional(),
  parentStatuses: Joi.array().items(configRefSchema).optional(),
  previousStatus: configRefSchema.optional(),
  field: Joi.string().optional(),
  fields: Joi.array().items(Joi.string()).optional(),
  fieldIds: Joi.array().items(Joi.string()).optional(),
}).unknown(true)

type PostFunctionConfiguration = {
  projectRole?: ConfigRef
  event?: ConfigRef
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

export type Rules = {
  validators?: Validator[]
  postFunctions?: PostFunction[]
  conditionsTree?: unknown
  conditions?: unknown
}

const rulesSchema = Joi.object({
  validators: Joi.array().items(validatorSchema).optional(),
  postFunctions: Joi.array().items(postFunctionSchema).optional(),
  conditionsTree: Joi.any().optional(),
  conditions: Joi.any().optional(),
}).unknown(true)

type Transitions = {
  type?: string
  rules?: Rules
}

const transitionsSchema = Joi.object({
  type: Joi.string().optional(),
  rules: rulesSchema.optional(),
}).unknown(true)

export type Status = {
  properties?: Values
}

const statusSchema = Joi.object({
  properties: Joi.object().optional(),
}).unknown(true)

export type Workflow = {
  id?: Id
  entityId?: string
  name?: string
  transitions?: Transitions[]
  statuses?: Status[]
}

const workflowSchema = Joi.object({
  id: idSchema.optional(),
  entityId: Joi.string().optional(),
  name: Joi.string().optional(),
  transitions: Joi.array().items(transitionsSchema).optional(),
  statuses: Joi.array().items(statusSchema).optional(),
}).unknown(true)

export type WorkflowInstance = InstanceElement & { value: InstanceElement['value'] & Workflow }

export const isWorkflowInstance = (instance: InstanceElement)
: instance is WorkflowInstance => {
  const { error } = workflowSchema.validate(instance.value)
  if (error !== undefined) {
    log.warn(`Received an invalid workflow: ${error.message}`)
    return false
  }
  return true
}
