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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, ListType,
} from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
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
    scriptfile: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
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
    library: {
      refType: createRefToElmWithValue(new ListType(pluginimplementation_libraries_library)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, pluginimplementationElemID.name],
})

pluginimplementationInnerTypes.push(pluginimplementation_libraries)


export const pluginimplementation = new ObjectType({
  elemID: pluginimplementationElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customscript[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    scriptfile: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
    customplugintype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the plugintype custom type. */
    status: {
      refType: createRefToElmWithValue(enums.plugintype_status),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see plugintype_status.   The default value is 'TESTING'. */
    description: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyadmins: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyemails: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    notifygroup: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    notifyuser: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    loglevel: {
      refType: createRefToElmWithValue(enums.plugintype_loglevel),
      annotations: {
      },
    }, /* Original description: For information about possible values, see plugintype_loglevel.   The default value is 'DEBUG'. */
    libraries: {
      refType: createRefToElmWithValue(pluginimplementation_libraries),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, pluginimplementationElemID.name],
})
