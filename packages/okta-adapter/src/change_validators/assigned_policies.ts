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
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isAdditionOrModificationChange,
  isReferenceExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { ACCESS_POLICY_TYPE_NAME, APPLICATION_TYPE_NAME, INACTIVE_STATUS } from '../constants'

const log = logger(module)

/**
 * Deactivation of AccessPolicy with assigned applications is not allowed
 */
export const assignedAccessPoliciesValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run usedAccessPoliciesValidator because element source is undefined')
    return []
  }
  const accessPolicies = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === ACCESS_POLICY_TYPE_NAME)
    .filter(instance => instance.value.status === INACTIVE_STATUS)

  const applications = await getInstancesFromElementSource(elementSource, [APPLICATION_TYPE_NAME])

  const accessPolicyToApplications = _.groupBy(
    applications.filter(app => app.value.accessPolicy !== undefined && isReferenceExpression(app.value.accessPolicy)),
    app => (app.value.accessPolicy as ReferenceExpression).elemID.getFullName(),
  )

  const assignedPolicies = accessPolicies.filter(
    policy => accessPolicyToApplications[policy.elemID.getFullName()] !== undefined,
  )

  return assignedPolicies.map(instance => ({
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Cannot deactivate an access policy with assigned applications',
    detailedMessage: `Access policy is used by the following applications: ${accessPolicyToApplications[instance.elemID.getFullName()].map(app => app.elemID.name).join(', ')}.`,
  }))
}
