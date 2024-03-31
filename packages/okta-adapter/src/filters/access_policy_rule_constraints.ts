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
import {
  Change,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  Values,
} from '@salto-io/adapter-api'
import { createSchemeGuard, resolvePath, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { ACCESS_POLICY_RULE_TYPE_NAME } from '../constants'

const log = logger(module)
const AUTHENTICATOR_CONSTRAINTS_PATH = ['actions', 'appSignOn', 'verificationMethod', 'constraints']

type ConstraintsEntry = {
  knowledge?: Values
  possession?: Values
}
const CONSTRAINTS_ENTRY_SCHEMA = Joi.object({
  knowledge: Joi.object().optional(),
  possession: Joi.object().optional(),
}).unknown(true)

const CONSTRAINTS_ARRAY_SCHEMA = Joi.array().items(CONSTRAINTS_ENTRY_SCHEMA).required()

const isConstraintsArray = createSchemeGuard<ConstraintsEntry[]>(
  CONSTRAINTS_ARRAY_SCHEMA,
  'Received an invalid constraints',
)

/**
 * Removes the `required` field from `possession` or `knowledge` object when it is optional.
 * By default, this field is true. If the `knowledge` or `possession` constraint has values for excludedAuthenticationMethods then the required value is false.
 * (source: https://developer.okta.com/docs/reference/api/policy/#constraints)
 */
const filter: FilterCreator = () => {
  const originalChangeByElemID: Record<string, InstanceElement> = {}
  return {
    name: 'accessPolicyRuleConstraintsFilter',
    preDeploy: async (changes: Change<InstanceElement>[]) => {
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === ACCESS_POLICY_RULE_TYPE_NAME)
        .forEach(async instance => {
          originalChangeByElemID[instance.elemID.getFullName()] = instance.clone()
          const constraintsArray = resolvePath(
            instance,
            instance.elemID.createNestedID(...AUTHENTICATOR_CONSTRAINTS_PATH),
          )
          if (isConstraintsArray(constraintsArray)) {
            constraintsArray.forEach(constraint => {
              const { possession, knowledge } = constraint
              if (possession?.excludedAuthenticationMethods === undefined) {
                // TODO - can remove after SALTO-5332 merged
                if (possession?.additionalProperties?.required === true) {
                  delete possession.additionalProperties.required
                  log.debug(
                    'omitting "required" field from possession object %s in instance %s',
                    safeJsonStringify(possession),
                    instance.elemID.getFullName(),
                  )
                }
                if (possession?.required === true) {
                  delete possession.required
                  log.debug(
                    'omitting "required" field from possession object %s in instance %s',
                    safeJsonStringify(possession),
                    instance.elemID.getFullName(),
                  )
                }
              }
              if (knowledge?.excludedAuthenticationMethods === undefined) {
                // TODO - can remove after SALTO-5332 merged
                if (knowledge?.additionalProperties?.required === true) {
                  delete knowledge.additionalProperties.required
                  log.debug(
                    'omitting "required" field from knowledge object %o in instance %s',
                    safeJsonStringify(knowledge),
                    instance.elemID.getFullName(),
                  )
                }
                if (knowledge?.required === true) {
                  delete knowledge.required
                  log.debug(
                    'omitting "required" field from knowledge object %o in instance %s',
                    safeJsonStringify(knowledge),
                    instance.elemID.getFullName(),
                  )
                }
              }
            })
          }
        })
    },
    onDeploy: async (changes: Change<InstanceElement>[]) => {
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === ACCESS_POLICY_RULE_TYPE_NAME)
        .forEach(async instance => {
          // restore actions to its original value
          if (originalChangeByElemID[instance.elemID.getFullName()] !== undefined) {
            instance.value.actions = originalChangeByElemID[instance.elemID.getFullName()].value.actions
          }
        })
    },
  }
}

export default filter
