/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import Joi from 'joi'
import _ from 'lodash'
import { createSchemeGuard, getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isModificationChange,
  isReferenceExpression,
  InstanceElement,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { AUTHENTICATOR_TYPE_NAME, MFA_POLICY_TYPE_NAME } from '../constants'
import { isDeactivation } from '../deprecated_deployment'

const log = logger(module)

type PolicyToAuthenticator = {
  policyName: string
  authenticatorId: string
}

type Authenticator = {
  key: ReferenceExpression
  enroll: {
    self: string
  }
}

const AUTHENTICATORS_SCHEMA = Joi.array()
  .items(
    Joi.object({
      key: Joi.required(),
      enroll: Joi.object({
        self: Joi.string().required(),
      })
        .unknown()
        .required(),
    }).unknown(true),
  )
  .required()

const areAuthenticators = createSchemeGuard<Authenticator[]>(
  AUTHENTICATORS_SCHEMA,
  'Received an invalid value for authenticators',
)

export const getAuthenticatorsFromMfaPolicy = (instance: InstanceElement): Authenticator[] => {
  const authenticators = instance.value.settings?.authenticators
  if (!areAuthenticators(authenticators)) {
    log.warn(`Received invalid authenticator for instance ${instance.elemID.getFullName()}`)
    return []
  }
  return authenticators
}

// Options are taken from: https://developer.okta.com/docs/reference/api/policy/#policy-factor-enroll-object
const ENABLED_AUTHENTICATORS = ['OPTIONAL', 'REQUIRED']

const getAutheticatorsForPolicy = (instance: InstanceElement): PolicyToAuthenticator[] => {
  const authenticators = getAuthenticatorsFromMfaPolicy(instance)
  return (
    authenticators
      // Indicates the authenticator is enabled for this policy
      .filter(authenticator => ENABLED_AUTHENTICATORS.includes(authenticator.enroll.self))
      .map(authenticator => authenticator.key)
      .filter(isReferenceExpression)
      .map(ref => ref.elemID.getFullName())
      .map(authenticatorId => ({ policyName: instance.elemID.name, authenticatorId }))
  )
}

/**
 * Don't deactivate Authenticator if it's enabled in MFA policy
 */
export const enabledAuthenticatorsValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run enabledAuthenticatorsValidator because element source is undefined')
    return []
  }
  const deactivatedAuthenticators = changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === AUTHENTICATOR_TYPE_NAME)
    .filter(change =>
      isDeactivation({ before: change.data.before.value.status, after: change.data.after.value.status }),
    )
    .map(getChangeData)

  if (_.isEmpty(deactivatedAuthenticators)) {
    return []
  }

  const mfaPolicies = await getInstancesFromElementSource(elementSource, [MFA_POLICY_TYPE_NAME])

  const authenticatorToPolicies = _.groupBy(
    mfaPolicies.flatMap(policy => getAutheticatorsForPolicy(policy)),
    authenticatorToPolicy => authenticatorToPolicy.authenticatorId,
  )

  return deactivatedAuthenticators
    .filter(instance => authenticatorToPolicies[instance.elemID.getFullName()] !== undefined)
    .map(instance => {
      const relevantPolicies = authenticatorToPolicies[instance.elemID.getFullName()].map(obj => obj.policyName)
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot deactivate authenticator because it is enabled in one or more MultifactorEnrollmentPolicy',
        detailedMessage: `This authenticator is enabled in the following MultifactorEnrollmentPolicy elements: ${relevantPolicies.join(', ')}. Please disable the authenticator in these policies before deactivating it.`,
      }
    })
}
