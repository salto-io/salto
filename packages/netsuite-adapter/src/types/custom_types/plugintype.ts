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

export const plugintypeInnerTypes: ObjectType[] = []

const plugintypeElemID = new ElemID(constants.NETSUITE, 'plugintype')
const plugintype_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'plugintype_libraries_library')

const plugintype_libraries_library = new ObjectType({
  elemID: plugintype_libraries_libraryElemID,
  annotations: {
  },
  fields: {
    scriptfile: new Field(
      plugintype_libraries_libraryElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, plugintypeElemID.name],
})

plugintypeInnerTypes.push(plugintype_libraries_library)

const plugintype_librariesElemID = new ElemID(constants.NETSUITE, 'plugintype_libraries')

const plugintype_libraries = new ObjectType({
  elemID: plugintype_librariesElemID,
  annotations: {
  },
  fields: {
    library: new Field(
      plugintype_librariesElemID,
      'library',
      new ListType(plugintype_libraries_library),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, plugintypeElemID.name],
})

plugintypeInnerTypes.push(plugintype_libraries)

const plugintype_methods_methodElemID = new ElemID(constants.NETSUITE, 'plugintype_methods_method')

const plugintype_methods_method = new ObjectType({
  elemID: plugintype_methods_methodElemID,
  annotations: {
  },
  fields: {
    method: new Field(
      plugintype_methods_methodElemID,
      'method',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 30,
      },
    ), /* Original description: This field value can be up to 30 characters long. */
    description: new Field(
      plugintype_methods_methodElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 30,
      },
    ), /* Original description: This field value can be up to 30 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, plugintypeElemID.name],
})

plugintypeInnerTypes.push(plugintype_methods_method)

const plugintype_methodsElemID = new ElemID(constants.NETSUITE, 'plugintype_methods')

const plugintype_methods = new ObjectType({
  elemID: plugintype_methodsElemID,
  annotations: {
  },
  fields: {
    method: new Field(
      plugintype_methodsElemID,
      'method',
      new ListType(plugintype_methods_method),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, plugintypeElemID.name],
})

plugintypeInnerTypes.push(plugintype_methods)


export const plugintype = new ObjectType({
  elemID: plugintypeElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customscript_',
  },
  fields: {
    scriptid: new Field(
      plugintypeElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: new Field(
      plugintypeElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    scriptfile: new Field(
      plugintypeElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
    deploymentmodel: new Field(
      plugintypeElemID,
      'deploymentmodel',
      enums.plugintype_deployment_model,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see plugintype_deployment_model. */
    status: new Field(
      plugintypeElemID,
      'status',
      enums.plugintype_status,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see plugintype_status.   The default value is 'TESTING'. */
    description: new Field(
      plugintypeElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    isinactive: new Field(
      plugintypeElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyadmins: new Field(
      plugintypeElemID,
      'notifyadmins',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyemails: new Field(
      plugintypeElemID,
      'notifyemails',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    notifygroup: new Field(
      plugintypeElemID,
      'notifygroup',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: new Field(
      plugintypeElemID,
      'notifyowner',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    notifyuser: new Field(
      plugintypeElemID,
      'notifyuser',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    class: new Field(
      plugintypeElemID,
      'class',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    documentationfile: new Field(
      plugintypeElemID,
      'documentationfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
      },
    ), /* Original description: This field must reference a .pdf file. */
    loglevel: new Field(
      plugintypeElemID,
      'loglevel',
      enums.plugintype_loglevel,
      {
      },
    ), /* Original description: For information about possible values, see plugintype_loglevel.   The default value is 'DEBUG'. */
    libraries: new Field(
      plugintypeElemID,
      'libraries',
      plugintype_libraries,
      {
      },
    ),
    methods: new Field(
      plugintypeElemID,
      'methods',
      plugintype_methods,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, plugintypeElemID.name],
})
