/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { ActionName, getChangeData, isAdditionChange } from '@salto-io/adapter-api'
import { definitions as definitionUtils } from '@salto-io/adapter-components'
import { AdditionalAction } from '../../types'
import { isActivationChange, isDeactivationChange } from './status'
import { ACTIVE_STATUS, INACTIVE_STATUS } from '../../../constants'

/**
 * Definition utils for types that have a "simple" status field.
 *
 * Okta has a few types with a 'status` field that can be activated or deactivated, but different types sometimes
 * have different activation/deactivation flows. This module provides utils for types with "simple" status flows, where:
 * - There are separate 'activate' and 'deactivate' actions.
 * - Primary actions on existing instances (modify, remove) have no requirements for a certain status.
 *
 * Deploy definitions can mix and match these utils depending on the type's specific requirements.
 *
 */

export const toSharedContext: definitionUtils.TransformDefinition<definitionUtils.deploy.ChangeAndContext> & {
  nestUnderElemId?: boolean
} = {
  pick: ['status'],
  nestUnderElemId: true,
}

const statusChangeCondition: (status: string) => definitionUtils.deploy.DeployRequestCondition['custom'] =
  status =>
  () =>
  ({ change, sharedContext }) => {
    if (isAdditionChange(change)) {
      if (getChangeData(change).value.status !== status) {
        return false
      }
      return _.get(sharedContext, [getChangeData(change).elemID.getFullName(), 'status']) !== status
    }
    return true
  }

export const activationCondition = statusChangeCondition(ACTIVE_STATUS)
export const deactivationCondition = statusChangeCondition(INACTIVE_STATUS)

export const modificationCondition: definitionUtils.deploy.DeployRequestCondition = {
  skipIfIdentical: true,
  transformForCheck: {
    omit: ['status'],
  },
}

export const toActionNames: ({
  change,
}: definitionUtils.deploy.ChangeAndContext) => (ActionName | AdditionalAction)[] = ({ change }) => {
  if (isAdditionChange(change)) {
    // Conditions inside 'activate' and 'deactivate' will determine which one to run, based on the service
    // response to the 'add' action.
    return ['add', 'deactivate', 'activate']
  }
  if (isActivationChange(change)) {
    return ['modify', 'activate']
  }
  if (isDeactivationChange(change)) {
    return ['deactivate', 'modify']
  }
  return [change.action]
}

export const actionDependencies: definitionUtils.deploy.ActionDependency<AdditionalAction>[] = [
  {
    first: 'add',
    second: 'activate',
  },
  {
    first: 'add',
    second: 'deactivate',
  },
  {
    first: 'modify',
    second: 'activate',
  },
  {
    first: 'deactivate',
    second: 'modify',
  },
]
