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
    .filter(change => getChangeData(change).elemID.typeName === MFA_POLICY_TYPE_NAME)
    .map(getChangeData)

  const disabledAuthenticatorsByMfaElemID: Record<string, InstanceElement[]> = Object.fromEntries(
    await awu(mfaInstances)
      .map(async policy => {
        const disabledAuthenticators = await awu(getAuthenticatorsFromMfaPolicy(policy))
          .map(async ({ key }) => key.getResolvedValue(elementSource))
          .filter(isInstanceElement)
          .toArray()
        return [
          policy.elemID.getFullName(),
          disabledAuthenticators.filter(({ value }) => value.status === INACTIVE_STATUS),
        ]
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
