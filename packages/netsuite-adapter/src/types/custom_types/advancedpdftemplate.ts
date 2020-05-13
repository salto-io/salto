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

export const advancedpdftemplateInnerTypes: ObjectType[] = []

const advancedpdftemplateElemID = new ElemID(constants.NETSUITE, 'advancedpdftemplate')

export const advancedpdftemplate = new ObjectType({
  elemID: advancedpdftemplateElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custtmpl_',
    [constants.ADDITIONAL_FILE_SUFFIX]: '.template.xml',
  },
  fields: {
    scriptid: new Field(
      advancedpdftemplateElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 98 characters long.   The default value is ‘custtmpl’. */
    standard: new Field(
      advancedpdftemplateElemID,
      'standard',
      enums.advancedpdftemplate_standard,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long.   For information about possible values, see advancedpdftemplate_standard. */
    title: new Field(
      advancedpdftemplateElemID,
      'title',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 297,
      },
    ), /* Original description: This field value can be up to 297 characters long. */
    description: new Field(
      advancedpdftemplateElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 4000,
      },
    ), /* Original description: This field value can be up to 4000 characters long. */
    displaysourcecode: new Field(
      advancedpdftemplateElemID,
      'displaysourcecode',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    preferred: new Field(
      advancedpdftemplateElemID,
      'preferred',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    isinactive: new Field(
      advancedpdftemplateElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    savedsearch: new Field(
      advancedpdftemplateElemID,
      'savedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   If this field appears in the project, you must reference the SERVERSIDESCRIPTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SERVERSIDESCRIPTING must be enabled for this field to appear in your account. */
    recordtype: new Field(
      advancedpdftemplateElemID,
      'recordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, advancedpdftemplateElemID.name],
})
