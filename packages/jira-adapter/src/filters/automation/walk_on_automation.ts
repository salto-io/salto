/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { WALK_NEXT_STEP, WalkOnFunc, walkOnValue } from '@salto-io/adapter-utils'
import { InstanceElement, Value } from '@salto-io/adapter-api'
import { AutomationInstance, isAutomationInstance } from './smart_values/smart_value_reference_filter'

const FIELDS_TO_WALK_ON = (): string[] => ['trigger', 'components']
const ADVANCED_FIELDS = 'advancedFields'

export const walkOnAutomation = ({ instance, func }: { instance: AutomationInstance; func: WalkOnFunc }): void => {
  FIELDS_TO_WALK_ON().forEach(fieldName => {
    if (instance.value[fieldName] !== undefined) {
      walkOnValue({
        elemId: instance.elemID.createNestedID(fieldName),
        value: instance.value[fieldName],
        func,
      })
    }
  })
}

export const walkOnAutomations = (instances: InstanceElement[], func: WalkOnFunc): void => {
  instances.filter(isAutomationInstance).forEach(instance => walkOnAutomation({ instance, func }))
}

export const advancedFieldsReferenceFunc =
  (func: (value: Value, fieldName: string) => void): WalkOnFunc =>
  ({ value }): WALK_NEXT_STEP => {
    if (value == null) {
      return WALK_NEXT_STEP.SKIP
    }
    if (Object.prototype.hasOwnProperty.call(value, ADVANCED_FIELDS)) {
      func(value, ADVANCED_FIELDS)
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
