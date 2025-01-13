/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { getChangeData, isModificationChange } from '@salto-io/adapter-api'
import { entraConstants } from '../../../../constants'
import { EndpointPath } from '../../../types'
import { DeployRequestDefinition, DeployableRequestDefinition } from '../../shared/types'

const {
  TOP_LEVEL_TYPES: { GROUP_TYPE_NAME },
  GROUP_LIFE_CYCLE_POLICY_FIELD_NAME,
} = entraConstants

export const getGroupLifecyclePolicyGroupModificationRequest = (action: 'add' | 'remove'): DeployRequestDefinition => ({
  endpoint: {
    path: `/groupLifecyclePolicies/{lifeCyclePolicyId}/${action}Group` as EndpointPath,
    method: 'post',
  },
  transformation: {
    pick: ['id'],
    adjust: async ({ value }) => {
      validatePlainObject(value, GROUP_TYPE_NAME)
      return {
        value: {
          groupId: value.id,
        },
      }
    },
  },
  context: {
    custom:
      () =>
      ({ change }) => {
        const dataWithPolicyId =
          action === 'remove' && isModificationChange(change) ? change.data.before.value : getChangeData(change).value
        return {
          lifeCyclePolicyId: _.get(dataWithPolicyId, `${GROUP_LIFE_CYCLE_POLICY_FIELD_NAME}.resValue.value.id`),
        }
      },
  },
})

export const createDefinitionForGroupLifecyclePolicyGroupModification = (
  action: 'add' | 'remove',
): DeployableRequestDefinition => ({
  request: getGroupLifecyclePolicyGroupModificationRequest(action),
  condition: {
    custom:
      () =>
      ({ change }) => {
        if (!isModificationChange(change)) {
          return false
        }
        const hadGroupLifecyclePolicy = !_.isEmpty(change.data.before.value[GROUP_LIFE_CYCLE_POLICY_FIELD_NAME])
        const hasGroupLifecyclePolicy = !_.isEmpty(change.data.after.value[GROUP_LIFE_CYCLE_POLICY_FIELD_NAME])
        return action === 'add'
          ? !hadGroupLifecyclePolicy && hasGroupLifecyclePolicy
          : hadGroupLifecyclePolicy && !hasGroupLifecyclePolicy
      },
  },
})
