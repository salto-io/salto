/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { isAdditionChange, isRemovalChange } from '@salto-io/adapter-api'
import {
  TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION,
  TYPE_NAME_TO_READ_ONLY_FIELDS_MODIFICATION,
} from '../../../change_validators'
import { AdjustFunctionSingle } from '../types'

/*
 * Omit read-only fields from the value, to avoid errors when trying to deploy them.
 */
export const omitReadOnlyFields: AdjustFunctionSingle = async ({ typeName, value, context: { change } }) => {
  validatePlainObject(value, typeName)
  if (isRemovalChange(change)) {
    return { value }
  }

  const readOnlyFieldsToOmit = isAdditionChange(change)
    ? TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION[typeName]
    : TYPE_NAME_TO_READ_ONLY_FIELDS_MODIFICATION[typeName]
  if (readOnlyFieldsToOmit === undefined) {
    return { value }
  }
  return { value: _.omit(value, readOnlyFieldsToOmit) }
}

/*
 * Adjust the value of the object using the provided adjust function, and then omit read-only fields from the result.
 */
export const omitReadOnlyFieldsWrapper: (adjust: AdjustFunctionSingle) => AdjustFunctionSingle =
  adjust => async args => {
    const result = await adjust(args)
    return {
      ...args,
      value: (await omitReadOnlyFields({ ...args, ...result })).value,
    }
  }
