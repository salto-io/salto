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
import { enums } from '../enums'

export const promotionspluginInnerTypes: ObjectType[] = []

const promotionspluginElemID = new ElemID(constants.NETSUITE, 'promotionsplugin')
const promotionsplugin_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'promotionsplugin_libraries_library')

const promotionsplugin_libraries_library = new ObjectType({
  elemID: promotionsplugin_libraries_libraryElemID,
  annotations: {
  },
  fields: {
    scriptfile: new Field(
      promotionsplugin_libraries_libraryElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, promotionspluginElemID.name],
})

promotionspluginInnerTypes.push(promotionsplugin_libraries_library)

const promotionsplugin_librariesElemID = new ElemID(constants.NETSUITE, 'promotionsplugin_libraries')

const promotionsplugin_libraries = new ObjectType({
  elemID: promotionsplugin_librariesElemID,
  annotations: {
  },
  fields: {
    library: new Field(
      promotionsplugin_librariesElemID,
      'library',
      new ListType(promotionsplugin_libraries_library),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, promotionspluginElemID.name],
})

promotionspluginInnerTypes.push(promotionsplugin_libraries)


export const promotionsplugin = new ObjectType({
  elemID: promotionspluginElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customscript_',
  },
  fields: {
    scriptid: new Field(
      promotionspluginElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: new Field(
      promotionspluginElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    scriptfile: new Field(
      promotionspluginElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
    description: new Field(
      promotionspluginElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    isinactive: new Field(
      promotionspluginElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyadmins: new Field(
      promotionspluginElemID,
      'notifyadmins',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyemails: new Field(
      promotionspluginElemID,
      'notifyemails',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    notifygroup: new Field(
      promotionspluginElemID,
      'notifygroup',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: new Field(
      promotionspluginElemID,
      'notifyowner',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    notifyuser: new Field(
      promotionspluginElemID,
      'notifyuser',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    loglevel: new Field(
      promotionspluginElemID,
      'loglevel',
      enums.script_loglevel,
      {
      },
    ), /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
    runasrole: new Field(
      promotionspluginElemID,
      'runasrole',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    status: new Field(
      promotionspluginElemID,
      'status',
      enums.script_status,
      {
      },
    ), /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    libraries: new Field(
      promotionspluginElemID,
      'libraries',
      promotionsplugin_libraries,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, promotionspluginElemID.name],
})
