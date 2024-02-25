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
  ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../../constants'
import { TypeAndInnerTypes } from '../../../types/object_types'
import { enums } from '../enums'

export const sspapplicationType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const sspapplicationElemID = new ElemID(constants.NETSUITE, 'sspapplication')
  const sspapplication_entrypoints_entrypointElemID = new ElemID(
    constants.NETSUITE,
    'sspapplication_entrypoints_entrypoint',
  )

  const sspapplication_entrypoints_entrypoint = new ObjectType({
    elemID: sspapplication_entrypoints_entrypointElemID,
    annotations: {},
    fields: {
      entrytype: {
        refType: createRefToElmWithValue(enums.webapp_entrytype),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: For information about possible values, see webapp_entrytype. */,
      entryitem: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field must reference a file with any of the following extensions: .html, .ss, .ssp */,
      entryparameter: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 60 }),
        },
      } /* Original description: This field value can be up to 60 characters long. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, sspapplicationElemID.name],
  })

  innerTypes.sspapplication_entrypoints_entrypoint = sspapplication_entrypoints_entrypoint

  const sspapplication_entrypointsElemID = new ElemID(constants.NETSUITE, 'sspapplication_entrypoints')

  const sspapplication_entrypoints = new ObjectType({
    elemID: sspapplication_entrypointsElemID,
    annotations: {},
    fields: {
      entrypoint: {
        refType: createRefToElmWithValue(new ListType(sspapplication_entrypoints_entrypoint)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, sspapplicationElemID.name],
  })

  innerTypes.sspapplication_entrypoints = sspapplication_entrypoints

  const sspapplication_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'sspapplication_libraries_library')

  const sspapplication_libraries_library = new ObjectType({
    elemID: sspapplication_libraries_libraryElemID,
    annotations: {},
    fields: {
      scriptfile: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field must reference a .js file. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, sspapplicationElemID.name],
  })

  innerTypes.sspapplication_libraries_library = sspapplication_libraries_library

  const sspapplication_librariesElemID = new ElemID(constants.NETSUITE, 'sspapplication_libraries')

  const sspapplication_libraries = new ObjectType({
    elemID: sspapplication_librariesElemID,
    annotations: {},
    fields: {
      library: {
        refType: createRefToElmWithValue(new ListType(sspapplication_libraries_library)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, sspapplicationElemID.name],
  })

  innerTypes.sspapplication_libraries = sspapplication_libraries

  const sspapplication = new ObjectType({
    elemID: sspapplicationElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^webapp[0-9a-z_]+' }),
        },
      } /* Original description: This attribute value can be up to 34 characters long.   The default value is ‘webapp’. */,
      name: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 40 }),
        },
      } /* Original description: This field value can be up to 40 characters long. */,
      status: {
        refType: createRefToElmWithValue(enums.plugintype_status),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: For information about possible values, see plugintype_status.   The default value is 'TESTING'. */,
      rootpath: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 999 }),
        },
      } /* Original description: This field value can be up to 999 characters long. */,
      appfolder: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was folderreference */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      runtimeversion: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 40 }),
        },
      } /* Original description: This field value can be up to 40 characters long.   The default value is '1.0'. */,
      description: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 3999 }),
        },
      } /* Original description: This field value can be up to 3999 characters long. */,
      isinactive: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      loglevel: {
        refType: createRefToElmWithValue(enums.plugintype_loglevel),
        annotations: {},
      } /* Original description: For information about possible values, see plugintype_loglevel.   The default value is 'DEBUG'. */,
      systemdomain: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: This field is available when the runtimeversion value is equal to 2.x.   The default value is F. */,
      defaultsspfile: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
        annotations: {},
      } /* Original description: This field must reference a file with any of the following extensions: .js, .ss, .ssp */,
      entrypoints: {
        refType: createRefToElmWithValue(sspapplication_entrypoints),
        annotations: {},
      },
      libraries: {
        refType: createRefToElmWithValue(sspapplication_libraries),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, sspapplicationElemID.name],
  })

  return { type: sspapplication, innerTypes }
}
