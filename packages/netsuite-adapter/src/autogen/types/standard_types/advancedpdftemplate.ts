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
import { enums } from '../enums'
import { fieldTypes } from '../../../types/field_types'

export const advancedpdftemplateType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const advancedpdftemplateElemID = new ElemID(constants.NETSUITE, 'advancedpdftemplate')

  const advancedpdftemplate = new ObjectType({
    elemID: advancedpdftemplateElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custtmpl[0-9a-z_]+' }),
        },
      } /* Original description: This attribute value can be up to 98 characters long.   The default value is ‘custtmpl’. */,
      standard: {
        refType: createRefToElmWithValue(enums.advancedpdftemplate_standard),
        annotations: {
          [constants.IS_ATTRIBUTE]: true,
        },
      } /* Original description: This attribute value can be up to 99 characters long.   For information about possible values, see advancedpdftemplate_standard. */,
      title: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 297 }),
        },
      } /* Original description: This field value can be up to 297 characters long. */,
      description: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 4000 }),
        },
      } /* Original description: This field value can be up to 4000 characters long. */,
      displaysourcecode: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      preferred: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      isinactive: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      trantype: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 4000 }),
        },
      } /* Original description: This field value can be up to 4000 characters long. */,
      printtype: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 4000 }),
        },
      } /* Original description: This field value can be up to 4000 characters long. */,
      savedsearch: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {},
      } /* Original description: This field accepts references to the savedsearch custom type.   If this field appears in the project, you must reference the SERVERSIDESCRIPTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SERVERSIDESCRIPTING must be enabled for this field to appear in your account. */,
      recordtype: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {},
      } /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype */,
      content: {
        refType: createRefToElmWithValue(fieldTypes.fileContent),
        annotations: {
          [constants.ADDITIONAL_FILE_SUFFIX]: 'xml',
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, advancedpdftemplateElemID.name],
  })

  return { type: advancedpdftemplate, innerTypes }
}
