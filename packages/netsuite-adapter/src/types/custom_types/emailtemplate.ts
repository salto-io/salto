/*
*                      Copyright 2021 Salto Labs Ltd.
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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'
import { fieldTypes } from '../field_types'

export const emailtemplateInnerTypes: ObjectType[] = []

const emailtemplateElemID = new ElemID(constants.NETSUITE, 'emailtemplate')

export const emailtemplate = new ObjectType({
  elemID: emailtemplateElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: 'standardemailtemplate|standardpaymentlinktransactionemailtemplate|^custemailtmpl[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custemailtmpl’. */
    name: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 60 }),
      },
    }, /* Original description: This field value can be up to 60 characters long. */
    mediaitem: {
      refType: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the usesmedia value is equal to T.   This field must reference a file with any of the following extensions: .ftl, .html, .txt */
    description: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 1000 }),
      },
    }, /* Original description: This field value can be up to 1000 characters long. */
    recordtype: {
      refType: enums.emailtemplate_recordtype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see emailtemplate_recordtype. */
    isinactive: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    subject: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 199 }),
      },
    }, /* Original description: This field value can be up to 199 characters long. */
    isprivate: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    addunsubscribelink: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    addcompanyaddress: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    usesmedia: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    content: {
      refType: fieldTypes.fileContent,
      annotations: {
        [constants.ADDITIONAL_FILE_SUFFIX]: 'html',
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, emailtemplateElemID.name],
})
