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
import _ from 'lodash'
import { createSchemeGuard, inspectValue, validatePlainObject } from '@salto-io/adapter-utils'
import { definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { MFA_POLICY_TYPE_NAME } from '../../../constants'

const log = logger(module)

const MFA_FACTORS_SCHEMA = Joi.object({
  settings: Joi.object({
    factors: Joi.object()
      .pattern(
        Joi.string(),
        Joi.object({
          enroll: Joi.object({
            self: Joi.string(),
          }).unknown(true),
        }).unknown(true),
      )
      .required(),
  })
    .unknown(true)
    .required(),
})
  .required()
  .unknown(true)

export type MfaFactorSchema = {
  enroll: {
    self: string
  }
}
type MfaFactorsSchema = {
  settings: {
    factors: Record<string, MfaFactorSchema>
  }
}

const isClassicEngineMfaPolicy = createSchemeGuard<MfaFactorsSchema>(MFA_FACTORS_SCHEMA)

/*
 * MFA policies in Okta identity Engine migrated from classic engine has factors object instead of authenticators array.
 * On the first change to the policy, factors object is automatically converted to authenticators.
 * This function converts the factors object to authenticators array for Okta identity Engine, in order to create references and allow deploy.
 * For reference, see https://developer.okta.com/docs/reference/api/policy/#policy-factor-enroll-object
 */
export const createMfaFactorsAdjustFunc: ({
  isClassicEngine,
}: {
  isClassicEngine?: boolean
}) => definitions.AdjustFunctionSingle =
  ({ isClassicEngine = false }) =>
  async ({ value }) => {
    validatePlainObject(value, MFA_POLICY_TYPE_NAME)
    if (isClassicEngine || !isClassicEngineMfaPolicy(value)) {
      return { value }
    }
    log.trace('adjusting MFA factors schema: %s', inspectValue(value.settings.factors))
    const adjustedFactors = Object.entries(value.settings.factors).map(([key, factor]) => ({
      key,
      ...factor,
    }))
    return {
      value: {
        ...value,
        settings: {
          ..._.omit(value.settings, 'factors'),
          type: 'AUTHENTICATORS',
          authenticators: adjustedFactors,
        },
      },
    }
  }
