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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'

export const customlistInnerTypes: ObjectType[] = []

const customlistElemID = new ElemID(constants.NETSUITE, 'customlist')
const customlist_customvalues_customvalueElemID = new ElemID(constants.NETSUITE, 'customlist_customvalues_customvalue')

const customlist_customvalues_customvalue = new ObjectType({
  elemID: customlist_customvalues_customvalueElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      customlist_customvalues_customvalueElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long. */
    value: new Field(
      customlist_customvalues_customvalueElemID,
      'value',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    abbreviation: new Field(
      customlist_customvalues_customvalueElemID,
      'abbreviation',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the ismatrixoption value is equal to T.   If this field appears in the project, you must reference the MATRIXITEMS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MATRIXITEMS must be enabled for this field to appear in your account. */
    isinactive: new Field(
      customlist_customvalues_customvalueElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customlistElemID.name],
})

customlistInnerTypes.push(customlist_customvalues_customvalue)

const customlist_customvaluesElemID = new ElemID(constants.NETSUITE, 'customlist_customvalues')

const customlist_customvalues = new ObjectType({
  elemID: customlist_customvaluesElemID,
  annotations: {
  },
  fields: {
    customvalue: new Field(
      customlist_customvaluesElemID,
      'customvalue',
      new ListType(customlist_customvalues_customvalue),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customlistElemID.name],
})

customlistInnerTypes.push(customlist_customvalues)


export const customlist = new ObjectType({
  elemID: customlistElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customlist_',
  },
  fields: {
    scriptid: new Field(
      customlistElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 38 characters long.   The default value is ‘customlist’. */
    name: new Field(
      customlistElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 30,
      },
    ), /* Original description: This field value can be up to 30 characters long. */
    description: new Field(
      customlistElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    isinactive: new Field(
      customlistElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismatrixoption: new Field(
      customlistElemID,
      'ismatrixoption',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the MATRIXITEMS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MATRIXITEMS must be enabled for this field to appear in your account. */
    isordered: new Field(
      customlistElemID,
      'isordered',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    customvalues: new Field(
      customlistElemID,
      'customvalues',
      customlist_customvalues,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customlistElemID.name],
})
