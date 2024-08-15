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

export const financiallayoutType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const financiallayoutElemID = new ElemID(constants.NETSUITE, 'financiallayout')
  const financiallayout_dependenciesElemID = new ElemID(constants.NETSUITE, 'financiallayout_dependencies')

  const financiallayout_dependencies = new ObjectType({
    elemID: financiallayout_dependenciesElemID,
    annotations: {},
    fields: {
      dependency: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field only accepts references to any custom type. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, financiallayoutElemID.name],
  })

  innerTypes.financiallayout_dependencies = financiallayout_dependencies

  const financiallayout = new ObjectType({
    elemID: financiallayoutElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customlayout[0-9a-z_]+' }),
        },
      } /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customlayout’. */,
      name: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      layout: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      dependencies: {
        refType: createRefToElmWithValue(financiallayout_dependencies),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, financiallayoutElemID.name],
  })

  return { type: financiallayout, innerTypes }
}
