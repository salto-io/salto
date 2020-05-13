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

export const pluginimplementationInnerTypes: ObjectType[] = []

const pluginimplementationElemID = new ElemID(constants.NETSUITE, 'pluginimplementation')
const pluginimplementation_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'pluginimplementation_libraries_library')

const pluginimplementation_libraries_library = new ObjectType({
  elemID: pluginimplementation_libraries_libraryElemID,
  annotations: {
  },
  fields: {
    scriptfile: new Field(
      pluginimplementation_libraries_libraryElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, pluginimplementationElemID.name],
})

pluginimplementationInnerTypes.push(pluginimplementation_libraries_library)

const pluginimplementation_librariesElemID = new ElemID(constants.NETSUITE, 'pluginimplementation_libraries')

const pluginimplementation_libraries = new ObjectType({
  elemID: pluginimplementation_librariesElemID,
  annotations: {
  },
  fields: {
    library: new Field(
      pluginimplementation_librariesElemID,
      'library',
      new ListType(pluginimplementation_libraries_library),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, pluginimplementationElemID.name],
})

pluginimplementationInnerTypes.push(pluginimplementation_libraries)


export const pluginimplementation = new ObjectType({
  elemID: pluginimplementationElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customscript_',
  },
  fields: {
    scriptid: new Field(
      pluginimplementationElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: new Field(
      pluginimplementationElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    scriptfile: new Field(
      pluginimplementationElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
    customplugintype: new Field(
      pluginimplementationElemID,
      'customplugintype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the plugintype custom type. */
    status: new Field(
      pluginimplementationElemID,
      'status',
      enums.plugintype_status,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see plugintype_status.   The default value is 'TESTING'. */
    description: new Field(
      pluginimplementationElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    isinactive: new Field(
      pluginimplementationElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyadmins: new Field(
      pluginimplementationElemID,
      'notifyadmins',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyemails: new Field(
      pluginimplementationElemID,
      'notifyemails',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    notifygroup: new Field(
      pluginimplementationElemID,
      'notifygroup',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: new Field(
      pluginimplementationElemID,
      'notifyowner',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    notifyuser: new Field(
      pluginimplementationElemID,
      'notifyuser',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    loglevel: new Field(
      pluginimplementationElemID,
      'loglevel',
      enums.plugintype_loglevel,
      {
      },
    ), /* Original description: For information about possible values, see plugintype_loglevel.   The default value is 'DEBUG'. */
    libraries: new Field(
      pluginimplementationElemID,
      'libraries',
      pluginimplementation_libraries,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, pluginimplementationElemID.name],
})
