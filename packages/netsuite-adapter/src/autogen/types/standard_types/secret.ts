/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
/* eslint-disable max-len */
/* eslint-disable camelcase */
import {
  BuiltinTypes,
  createRefToElmWithValue,
  CORE_ANNOTATIONS,
  ElemID,
  ObjectType,
  createRestriction,
} from '@salto-io/adapter-api'
import * as constants from '../../../constants'
import { TypeAndInnerTypes } from '../../../types/object_types'

export const secretType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const secretElemID = new ElemID(constants.NETSUITE, 'secret')

  const secret = new ObjectType({
    elemID: secretElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custsecret[0-9a-z_]+' }),
        },
      } /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custsecret’. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, secretElemID.name],
  })

  return { type: secret, innerTypes }
}
