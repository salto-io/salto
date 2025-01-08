/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  DependencyChanger,
  InstanceElement,
  ModificationChange,
  dependencyChange,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { AUTHENTICATOR_TYPE_NAME, MFA_POLICY_TYPE_NAME } from '../constants'
import { getAuthenticatorsFromMfaPolicy } from '../change_validators/enabled_authenticators'

const log = logger(module)

/*
 * Add dependency from Authenticator change to MultifactorEnrollmentPolicy additions or modifications.
 * Authenticator must be activated before it can be used by a MultifactorEnrollmentPolicy.
 */
export const addAuthenticatorToMfaPolicyDependency: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const mfaChanges = instanceChanges
    .filter(change => isAdditionOrModificationChange(change.change))
    .filter(change => getChangeData(change.change).elemID.typeName === MFA_POLICY_TYPE_NAME)

  const authenticatorChanges = instanceChanges
    // authenticator addition changes are handled by addReferencesDependency in core
    .filter(change => isModificationChange(change.change))
    .filter(change => getChangeData(change.change).elemID.typeName === AUTHENTICATOR_TYPE_NAME)

  if (_.isEmpty(mfaChanges) || _.isEmpty(authenticatorChanges)) {
    return []
  }

  const authenticatorChangesById = _.keyBy(authenticatorChanges, change =>
    getChangeData(change.change).elemID.getFullName(),
  )

  const changedAuthenticatorsElemIDs = new Set(Object.keys(authenticatorChangesById))

  return mfaChanges
    .flatMap(mfaChange => {
      const usedAuthenticatorChanges = getAuthenticatorsFromMfaPolicy(getChangeData(mfaChange.change))
        .map(authenticator => authenticator.key)
        .map(reference => reference.elemID.getFullName())
        .filter(authenticatorId => changedAuthenticatorsElemIDs.has(authenticatorId))
        .map(authenticatorId => authenticatorChangesById[authenticatorId])
        .filter(values.isDefined)
      const dependencies = usedAuthenticatorChanges.map(authenticator =>
        dependencyChange('add', mfaChange.key, authenticator.key),
      )
      log.debug(
        'addAuthenticatorToMfaPolicyDependency added the following dependencies: %s',
        safeJsonStringify(dependencies.map(d => d.dependency)),
      )
      return dependencies
    })
    .filter(values.isDefined)
}
