/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  Value,
  getChangeData,
  isInstanceElement,
  isRemovalOrModificationChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { entraConstants, intuneConstants } from '../../constants'

type BuiltInIndicator = {
  fieldName: string
  value: Value
}
const POTENTIAL_BUILD_IN_TYPES: Record<string, BuiltInIndicator> = {
  [entraConstants.TOP_LEVEL_TYPES.AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME]: {
    fieldName: 'policyType',
    value: 'builtIn',
  },
  [entraConstants.TOP_LEVEL_TYPES.ROLE_DEFINITION_TYPE_NAME]: {
    fieldName: 'isBuiltIn',
    value: true,
  },
  [intuneConstants.TOP_LEVEL_TYPES.SCOPE_TAG_TYPE_NAME]: {
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
