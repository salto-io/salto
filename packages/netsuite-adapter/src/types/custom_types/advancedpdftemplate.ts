/*
*                      Copyright 2020 Salto Labs Ltd.
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
/* eslint-disable @typescript-eslint/camelcase */
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'
import { fieldTypes } from '../field_types'

export const advancedpdftemplateInnerTypes: ObjectType[] = []

const advancedpdftemplateElemID = new ElemID(constants.NETSUITE, 'advancedpdftemplate')

export const advancedpdftemplate = new ObjectType({
  elemID: advancedpdftemplateElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custtmpl_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 98 characters long.   The default value is ‘custtmpl’. */
    standard: {
      type: enums.advancedpdftemplate_standard,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   For information about possible values, see advancedpdftemplate_standard. */
    title: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 297,
      },
    }, /* Original description: This field value can be up to 297 characters long. */
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 4000,
      },
    }, /* Original description: This field value can be up to 4000 characters long. */
    displaysourcecode: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    preferred: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    isinactive: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    savedsearch: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   If this field appears in the project, you must reference the SERVERSIDESCRIPTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SERVERSIDESCRIPTING must be enabled for this field to appear in your account. */
    recordtype: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype */
    content: {
      type: fieldTypes.fileContent,
      annotations: {
        [constants.ADDITIONAL_FILE_SUFFIX]: 'xml',
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, advancedpdftemplateElemID.name],
})
