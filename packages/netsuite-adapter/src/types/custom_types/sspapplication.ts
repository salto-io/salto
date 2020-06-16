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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, ListType,
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
    entrytype: {
      type: enums.webapp_entrytype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see webapp_entrytype. */
    entryitem: {
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a file with any of the following extensions: .html, .ss, .ssp */
    entryparameter: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 60,
      },
    }, /* Original description: This field value can be up to 60 characters long. */
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
    entrypoint: {
      type: new ListType(sspapplication_entrypoints_entrypoint),
      annotations: {
      },
    },
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
    scriptfile: {
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
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
    library: {
      type: new ListType(sspapplication_libraries_library),
      annotations: {
      },
    },
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
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 34 characters long.   The default value is ‘webapp’. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    status: {
      type: enums.plugintype_status,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see plugintype_status.   The default value is 'TESTING'. */
    rootpath: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    appfolder: {
      type: BuiltinTypes.STRING /* Original type was folderreference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 3999,
      },
    }, /* Original description: This field value can be up to 3999 characters long. */
    isinactive: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    loglevel: {
      type: enums.plugintype_loglevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see plugintype_loglevel.   The default value is 'DEBUG'. */
    entrypoints: {
      type: sspapplication_entrypoints,
      annotations: {
      },
    },
    libraries: {
      type: sspapplication_libraries,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, sspapplicationElemID.name],
})
