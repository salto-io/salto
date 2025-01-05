/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import { Values } from '@salto-io/adapter-api'
import { PARENT_ID_FIELD_NAME } from '../../../../constants'
import { AdjustFunctionSingle } from '../types'

// This is the reverse of addParentIdToStandaloneFields.
// The parent_id field is not deployable and is added during fetch for internal use.
export const omitParentIdFromPathAdjustCreator: (...fieldPath: string[]) => AdjustFunctionSingle =
  (...fieldPath) =>
  async ({ value, typeName }) => {
    validatePlainObject(value, typeName)
    const fieldValues = _.get(value, fieldPath)
    if (!_.isEmpty(fieldValues)) {
      validateArray(fieldValues, fieldPath.join('.'))
      _.set(
        value,
        fieldPath,
        fieldValues.map((fieldValue: unknown): Values => {
          validatePlainObject(fieldValue, fieldPath.join('.'))
          return _.omit(fieldValue, PARENT_ID_FIELD_NAME)
        }),
      )
    }
    return { value }
  }
