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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const emailtemplateInnerTypes: ObjectType[] = []

const emailtemplateElemID = new ElemID(constants.NETSUITE, 'emailtemplate')

export const emailtemplate = new ObjectType({
  elemID: emailtemplateElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custemailtmpl_',
    [constants.ADDITIONAL_FILE_SUFFIX]: '.template.html',
  },
  fields: {
    scriptid: new Field(
      emailtemplateElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custemailtmpl’. */
    name: new Field(
      emailtemplateElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 60,
      },
    ), /* Original description: This field value can be up to 60 characters long. */
    mediaitem: new Field(
      emailtemplateElemID,
      'mediaitem',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
      },
    ), /* Original description: This field is mandatory when the usesmedia value is equal to T.   This field must reference a file with any of the following extensions: .ftl, .html, .txt */
    description: new Field(
      emailtemplateElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 1000,
      },
    ), /* Original description: This field value can be up to 1000 characters long. */
    recordtype: new Field(
      emailtemplateElemID,
      'recordtype',
      enums.emailtemplate_recordtype,
      {
      },
    ), /* Original description: For information about possible values, see emailtemplate_recordtype. */
    isinactive: new Field(
      emailtemplateElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    subject: new Field(
      emailtemplateElemID,
      'subject',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 199,
      },
    ), /* Original description: This field value can be up to 199 characters long. */
    isprivate: new Field(
      emailtemplateElemID,
      'isprivate',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    addunsubscribelink: new Field(
      emailtemplateElemID,
      'addunsubscribelink',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    addcompanyaddress: new Field(
      emailtemplateElemID,
      'addcompanyaddress',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    usesmedia: new Field(
      emailtemplateElemID,
      'usesmedia',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, emailtemplateElemID.name],
})
