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
import {
  ChangeValidator,
  Value,
  getChangeData,
  isInstanceElement,
  isRemovalOrModificationChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME, ROLE_DEFINITION_TYPE_NAME } from '../constants'

type BuiltInIndicator = {
  fieldName: string
  value: Value
}
const POTENTIAL_BUILD_IN_TYPES: Record<string, BuiltInIndicator> = {
  [AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME]: {
    fieldName: 'policyType',
    value: 'builtIn',
  },
  [ROLE_DEFINITION_TYPE_NAME]: {
    fieldName: 'isBuiltIn',
    value: true,
  },
}

/*
 * Validates that built-in instances are not modified or removed.
 */
export const builtInInstancesValidator: ChangeValidator = async changes => {
  const potentialBuiltInInstances = changes
    .filter(isRemovalOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => Object.keys(POTENTIAL_BUILD_IN_TYPES).includes(instance.elemID.typeName))

  const potentialBuiltInInstancesByType = _.groupBy(potentialBuiltInInstances, change => change.elemID.typeName)

  return Object.entries(potentialBuiltInInstancesByType).flatMap(([typeName, instances]) => {
    const builtInIndicator = POTENTIAL_BUILD_IN_TYPES[typeName]
    const builtInInstancesChanges = instances.filter(
      instance => _.get(instance.value, builtInIndicator.fieldName) === builtInIndicator.value,
    )
    return builtInInstancesChanges.map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Built-in elements are read-only',
      detailedMessage: 'Built-in elements cannot be modified or removed',
    }))
  })
}
