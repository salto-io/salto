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

export const sspapplicationInnerTypes: ObjectType[] = []

const sspapplicationElemID = new ElemID(constants.NETSUITE, 'sspapplication')
const sspapplication_entrypoints_entrypointElemID = new ElemID(constants.NETSUITE, 'sspapplication_entrypoints_entrypoint')

const sspapplication_entrypoints_entrypoint = new ObjectType({
  elemID: sspapplication_entrypoints_entrypointElemID,
  annotations: {
  },
  fields: {
    entrytype: new Field(
      sspapplication_entrypoints_entrypointElemID,
      'entrytype',
      enums.webapp_entrytype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see webapp_entrytype. */
    entryitem: new Field(
      sspapplication_entrypoints_entrypointElemID,
      'entryitem',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a file with any of the following extensions: .html, .ss, .ssp */
    entryparameter: new Field(
      sspapplication_entrypoints_entrypointElemID,
      'entryparameter',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 60,
      },
    ), /* Original description: This field value can be up to 60 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, sspapplicationElemID.name],
})

sspapplicationInnerTypes.push(sspapplication_entrypoints_entrypoint)

const sspapplication_entrypointsElemID = new ElemID(constants.NETSUITE, 'sspapplication_entrypoints')

const sspapplication_entrypoints = new ObjectType({
  elemID: sspapplication_entrypointsElemID,
  annotations: {
  },
  fields: {
    entrypoint: new Field(
      sspapplication_entrypointsElemID,
      'entrypoint',
      new ListType(sspapplication_entrypoints_entrypoint),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, sspapplicationElemID.name],
})

sspapplicationInnerTypes.push(sspapplication_entrypoints)

const sspapplication_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'sspapplication_libraries_library')

const sspapplication_libraries_library = new ObjectType({
  elemID: sspapplication_libraries_libraryElemID,
  annotations: {
  },
  fields: {
    scriptfile: new Field(
      sspapplication_libraries_libraryElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, sspapplicationElemID.name],
})

sspapplicationInnerTypes.push(sspapplication_libraries_library)

const sspapplication_librariesElemID = new ElemID(constants.NETSUITE, 'sspapplication_libraries')

const sspapplication_libraries = new ObjectType({
  elemID: sspapplication_librariesElemID,
  annotations: {
  },
  fields: {
    library: new Field(
      sspapplication_librariesElemID,
      'library',
      new ListType(sspapplication_libraries_library),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, sspapplicationElemID.name],
})

sspapplicationInnerTypes.push(sspapplication_libraries)


export const sspapplication = new ObjectType({
  elemID: sspapplicationElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'webapp_',
  },
  fields: {
    scriptid: new Field(
      sspapplicationElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 34 characters long.   The default value is ‘webapp’. */
    name: new Field(
      sspapplicationElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    status: new Field(
      sspapplicationElemID,
      'status',
      enums.plugintype_status,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see plugintype_status.   The default value is 'TESTING'. */
    rootpath: new Field(
      sspapplicationElemID,
      'rootpath',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    appfolder: new Field(
      sspapplicationElemID,
      'appfolder',
      BuiltinTypes.STRING /* Original type was folderreference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    description: new Field(
      sspapplicationElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 3999,
      },
    ), /* Original description: This field value can be up to 3999 characters long. */
    isinactive: new Field(
      sspapplicationElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    loglevel: new Field(
      sspapplicationElemID,
      'loglevel',
      enums.plugintype_loglevel,
      {
      },
    ), /* Original description: For information about possible values, see plugintype_loglevel.   The default value is 'DEBUG'. */
    entrypoints: new Field(
      sspapplicationElemID,
      'entrypoints',
      sspapplication_entrypoints,
      {
      },
    ),
    libraries: new Field(
      sspapplicationElemID,
      'libraries',
      sspapplication_libraries,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, sspapplicationElemID.name],
})
