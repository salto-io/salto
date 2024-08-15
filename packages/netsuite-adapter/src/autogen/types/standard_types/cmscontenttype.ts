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

export const cmscontenttypeType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const cmscontenttypeElemID = new ElemID(constants.NETSUITE, 'cmscontenttype')

  const cmscontenttype = new ObjectType({
    elemID: cmscontenttypeElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custcontenttype[0-9a-z_]+' }),
        },
      } /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custcontenttype’. */,
      name: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 999 }),
        },
      } /* Original description: This field value can be up to 999 characters long. */,
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 18 }),
        },
      } /* Original description: This field value can be up to 18 characters long. */,
      customrecordid: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field accepts references to the customrecordtype custom type. */,
      description: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 999 }),
        },
      } /* Original description: This field value can be up to 999 characters long. */,
      iconimagepath: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 999 }),
        },
      } /* Original description: This field value can be up to 999 characters long. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, cmscontenttypeElemID.name],
  })

  return { type: cmscontenttype, innerTypes }
}
