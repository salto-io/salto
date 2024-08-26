/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { concatAdjustFunctions, deployment } from '@salto-io/adapter-components'
import { getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { AdjustFunctionSingle } from '../types'
import { omitReadOnlyFields } from './read_only_fields'

const adjustRemovedValuesToNull: AdjustFunctionSingle = async ({ typeName, value, context }) => {
  const { change } = context
  validatePlainObject(value, typeName)
  if (!isModificationChange(change) || !isInstanceChange(change)) {
    return {
      value,
    }
  }
  const adjustedChange = deployment.transformRemovedValuesToNull({ change, skipSubFields: true })
  return {
    context: {
      ...context,
      change: adjustedChange,
    },
    value: getChangeData(adjustedChange).value,
  }
}

/**
 * Default adjust functions to apply to all values before deployment
 * 1. Transform removed values to null
 * 2. Omit read-only fields
 */
export const defaultAdjust = concatAdjustFunctions(adjustRemovedValuesToNull, omitReadOnlyFields)

/*
 * Adjust the value of the object using default adjust function, and then apply the provided adjust function
 */
export const adjustWrapper: (adjust: AdjustFunctionSingle) => AdjustFunctionSingle = adjust =>
  concatAdjustFunctions(defaultAdjust, adjust)
