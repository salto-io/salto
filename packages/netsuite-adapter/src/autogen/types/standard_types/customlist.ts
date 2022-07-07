/*
*                      Copyright 2022 Salto Labs Ltd.
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
/* eslint-disable max-len */
/* eslint-disable camelcase */
import {
  BuiltinTypes, createRefToElmWithValue, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../../constants'
import { TypeAndInnerTypes } from '../../../types/object_types'

export const customlistType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const customlistElemID = new ElemID(constants.NETSUITE, 'customlist')
  const customlist_customvalues_customvalueElemID = new ElemID(constants.NETSUITE, 'customlist_customvalues_customvalue')

  const customlist_customvalues_customvalue = new ObjectType({
    elemID: customlist_customvalues_customvalueElemID,
    annotations: {
    },
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
        },
      }, /* Original description: This attribute value can be up to 40 characters long. */
      value: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      }, /* Original description: This field accepts references to the string custom type. */
      abbreviation: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
        },
      }, /* Original description: This field is mandatory when the ismatrixoption value is equal to T.   If this field appears in the project, you must reference the MATRIXITEMS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MATRIXITEMS must be enabled for this field to appear in your account. */
      isinactive: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {
        },
      }, /* Original description: The default value is F. */
      internalId: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, customlistElemID.name],
  })

  innerTypes.customlist_customvalues_customvalue = customlist_customvalues_customvalue

  const customlist_customvaluesElemID = new ElemID(constants.NETSUITE, 'customlist_customvalues')

  const customlist_customvalues = new ObjectType({
    elemID: customlist_customvaluesElemID,
    annotations: {
    },
    fields: {
      customvalue: {
        refType: createRefToElmWithValue(new ListType(customlist_customvalues_customvalue)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, customlistElemID.name],
  })

  innerTypes.customlist_customvalues = customlist_customvalues


  const customlist = new ObjectType({
    elemID: customlistElemID,
    annotations: {
    },
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customlist[0-9a-z_]+' }),
        },
      }, /* Original description: This attribute value can be up to 38 characters long.   The default value is ‘customlist’. */
      name: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 30 }),
        },
      }, /* Original description: This field value can be up to 30 characters long.   This field accepts references to the string custom type. */
      description: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
        },
      },
      isinactive: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {
        },
      }, /* Original description: The default value is F. */
      ismatrixoption: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {
        },
      }, /* Original description: The default value is F.   If this field appears in the project, you must reference the MATRIXITEMS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MATRIXITEMS must be enabled for this field to appear in your account. */
      isordered: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {
        },
      }, /* Original description: The default value is T. */
      customvalues: {
        refType: createRefToElmWithValue(customlist_customvalues),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, customlistElemID.name],
  })


  return { type: customlist, innerTypes }
}
