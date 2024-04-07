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
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { ChangeValidator, getChangeData, isInstanceChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { DEVICE_ASSURANCE, FEATURE_TYPE_NAME } from '../constants'

const log = logger(module)

const DYNAMIC_OS_VERSION_FEATURE_NAME = 'Dynamic OS version compliance'

const DYNAMIC_OS_VERSION_PATH_OPTIONS = [
  ['osVersion', 'dynamicVersionRequirement'],
  ['osVersionConstraints'],
  // support paths including additionalProperties for backward compatibility
  // TODO - remove after SALTO-5332s
  ['osVersion', 'additionalProperties', 'dynamicVersionRequirement'],
  ['additionalProperties', 'osVersionConstraints'],
]

/**
 * Device assurance policies only support defining dynamic OS constraints when Dynamic OS version compliance feature is enabled.
 * The validaor verifies the feature is enabled in the account before attempting to deploy device assurance policies with dynamic OS constraints.
 * source: https://developer.okta.com/docs/api/openapi/okta-management/management/tag/DeviceAssurance/
 */
export const dynamicOSVersionFeatureValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run dynamicOSVersionFeatureValidator because element source is undefined')
    return []
  }

  const relevantDeviceAssuranceInstances = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === DEVICE_ASSURANCE)
    .filter(instance => DYNAMIC_OS_VERSION_PATH_OPTIONS.some(path => _.get(instance.value, path) !== undefined))

  if (_.isEmpty(relevantDeviceAssuranceInstances)) {
    return []
  }

  const dynamicOSVersionFeature = (await getInstancesFromElementSource(elementSource, [FEATURE_TYPE_NAME])).find(
    instance => instance.value.name === DYNAMIC_OS_VERSION_FEATURE_NAME,
  )

  if (!dynamicOSVersionFeature) {
    log.debug(`Failed to find ${DYNAMIC_OS_VERSION_FEATURE_NAME} feature, skipping dynamicOSVersionFeatureValidator`)
    return []
  }

  if (dynamicOSVersionFeature.value.status === 'ENABLED') {
    return []
  }

  return relevantDeviceAssuranceInstances.map(instance => ({
    elemID: instance.elemID,
    severity: 'Error',
    message: `${DYNAMIC_OS_VERSION_FEATURE_NAME} feature is not enabled in the account`,
    detailedMessage: `This Device Assurance policy is using dynamic OS version constraints which requires the ${DYNAMIC_OS_VERSION_FEATURE_NAME} feature to be enabled in the account. To fix this error, enable this feature in your account, fetch your updated configuration through Salto and refresh this deployment.`,
  }))
}
