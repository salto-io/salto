/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isAdditionOrModificationChange,
  isInstanceElement,
  InstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getElementPrettyName } from '@salto-io/adapter-utils'
import { INACTIVE_STATUS, MFA_POLICY_TYPE_NAME } from '../constants'
import { getAuthenticatorsFromMfaPolicy } from './enabled_authenticators'

const log = logger(module)
const { awu } = collections.asynciterable

/**
 * Verify all used authenticators in MFA policy are enabled
 */
export const disabledAuthenticatorsInMfaPolicyValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run disabledAuthenticatorsInMfaPolicy because element source is undefined')
    return []
  }
  const mfaInstances = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(({ elemID }) => elemID.typeName === MFA_POLICY_TYPE_NAME)

  const disabledAuthenticatorsByMfaElemID: Record<string, InstanceElement[]> = Object.fromEntries(
    await awu(mfaInstances)
      .map(async policy => {
        const disabledAuthenticators = await awu(getAuthenticatorsFromMfaPolicy(policy))
          .map(async ({ key }) => key.getResolvedValue(elementSource))
          .filter(isInstanceElement)
          .filter(({ value }) => value.status === INACTIVE_STATUS)
          .toArray()
        return [policy.elemID.getFullName(), disabledAuthenticators]
      })
      .toArray(),
  )

  return mfaInstances
    .filter(instance => disabledAuthenticatorsByMfaElemID[instance.elemID.getFullName()].length > 0)
    .map(instance => {
      const disabledAuthenticators = disabledAuthenticatorsByMfaElemID[instance.elemID.getFullName()]
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot use disabled authenticators in authenticator enrollment policy.',
        detailedMessage: `The following authenticators are disabled and can not be used in the configured policy: ${disabledAuthenticators.map(inst => getElementPrettyName(inst)).join(', ')}. To continue with this deployment, enabled those authenticators.`,
      }
    })
}
