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

export const plugintypeInnerTypes: ObjectType[] = []

const plugintypeElemID = new ElemID(constants.NETSUITE, 'plugintype')
const plugintype_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'plugintype_libraries_library')

const plugintype_libraries_library = new ObjectType({
  elemID: plugintype_libraries_libraryElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, plugintypeElemID.name],
})

plugintypeInnerTypes.push(plugintype_libraries_library)

const plugintype_librariesElemID = new ElemID(constants.NETSUITE, 'plugintype_libraries')

const plugintype_libraries = new ObjectType({
  elemID: plugintype_librariesElemID,
  annotations: {
  },
  fields: {
    library: {
      refType: createRefToElmWithValue(new ListType(plugintype_libraries_library)),
      annotations: {
      },
    },
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
    method: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 30,
      },
    }, /* Original description: This field value can be up to 30 characters long. */
    description: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 30,
      },
    }, /* Original description: This field value can be up to 30 characters long. */
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
    method: {
      refType: createRefToElmWithValue(new ListType(plugintype_methods_method)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, plugintypeElemID.name],
})

plugintypeInnerTypes.push(plugintype_methods)


export const plugintype = new ObjectType({
  elemID: plugintypeElemID,
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
    deploymentmodel: {
      refType: createRefToElmWithValue(enums.plugintype_deployment_model),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see plugintype_deployment_model. */
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
    class: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    documentationfile: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
      annotations: {
      },
    }, /* Original description: This field must reference a .pdf file. */
    loglevel: {
      refType: createRefToElmWithValue(enums.plugintype_loglevel),
      annotations: {
      },
    }, /* Original description: For information about possible values, see plugintype_loglevel.   The default value is 'DEBUG'. */
    libraries: {
      refType: createRefToElmWithValue(plugintype_libraries),
      annotations: {
      },
    },
    methods: {
      refType: createRefToElmWithValue(plugintype_methods),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, plugintypeElemID.name],
})
