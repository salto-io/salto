/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { values } from '@salto-io/lowerdash'
import { definitions } from '@salto-io/adapter-components'
import {
  Change,
  ElemID,
  getAllChangeData,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isEqualValues,
  isInstanceElement,
  isModificationChange,
  ReadOnlyElementsSource,
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { ClientOptions } from '../../types'
import { CUSTOM_NAME_FIELD, INACTIVE_STATUS, OKTA, ORG_SETTING_TYPE_NAME } from '../../../constants'

const { isDefined } = values
const log = logger(module)

const createDeployAppPolicyRequest = (
  policyName: string,
): definitions.deploy.DeployableRequestDefinition<ClientOptions> => ({
  condition: {
    custom:
      () =>
      ({ change }) => {
        const getPolicy = (value: Values): boolean => _.get(value, policyName)
        if (isDefined(getPolicy(getChangeData(change).value))) {
          if (isAdditionChange(change)) {
            return true
          }
          if (isModificationChange(change)) {
            const [before, after] = getAllChangeData(change).map(data => getPolicy(data.value))
            return isDefined(before) && isDefined(after) && !isEqualValues(before, after)
          }
        }
        return false
      },
  },
  request: {
    endpoint: {
      path: '/api/v1/apps/{source}/policies/{target}',
      method: 'put',
    },
    context: {
      source: '{id}',
      target: `{${policyName}}`,
    },
  },
})

export const APP_POLICIES = ['accessPolicy', 'profileEnrollment']

export const createDeployAppPolicyRequests = (): definitions.deploy.DeployableRequestDefinition<ClientOptions>[] =>
  APP_POLICIES.map(createDeployAppPolicyRequest)

export const isInactiveCustomAppChange = (change: Change<InstanceElement>): boolean =>
  isModificationChange(change) &&
  _.isEqual(
    getAllChangeData(change).map(data => data.value.status),
    [INACTIVE_STATUS, INACTIVE_STATUS],
  ) &&
  // customName field only exist in custom applications
  getChangeData(change).value[CUSTOM_NAME_FIELD] !== undefined

export const getSubdomainFromElementsSource = async (
  elementsSource: ReadOnlyElementsSource,
): Promise<string | undefined> => {
  const orgSettingInstance = await elementsSource.get(
    new ElemID(OKTA, ORG_SETTING_TYPE_NAME, 'instance', ElemID.CONFIG_NAME),
  )
  if (!isInstanceElement(orgSettingInstance)) {
    log.error(`Failed to get ${ORG_SETTING_TYPE_NAME} instance, can not find subdomain`)
    return undefined
  }
  return orgSettingInstance.value.subdomain
}
