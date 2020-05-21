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

export const centertabInnerTypes: ObjectType[] = []

const centertabElemID = new ElemID(constants.NETSUITE, 'centertab')
const centertab_portlets_portletElemID = new ElemID(constants.NETSUITE, 'centertab_portlets_portlet')

const centertab_portlets_portlet = new ObjectType({
  elemID: centertab_portlets_portletElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    portlet: {
      type: enums.generic_portlet,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_portlet. */
    portletcolumn: {
      type: enums.generic_portletcolumn,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_portletcolumn. */
    isportletshown: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, centertabElemID.name],
})

centertabInnerTypes.push(centertab_portlets_portlet)

const centertab_portletsElemID = new ElemID(constants.NETSUITE, 'centertab_portlets')

const centertab_portlets = new ObjectType({
  elemID: centertab_portletsElemID,
  annotations: {
  },
  fields: {
    portlet: {
      type: new ListType(centertab_portlets_portlet),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, centertabElemID.name],
})

centertabInnerTypes.push(centertab_portlets)


export const centertab = new ObjectType({
  elemID: centertabElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custcentertab_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custcentertab’. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
      },
    },
    center: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the center custom type.   For information about other possible values, see generic_centertype. */
    allvendors: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allroles: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allpartners: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */
    allcustomers: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allemployees: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    audslctrole: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    portlets: {
      type: centertab_portlets,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, centertabElemID.name],
})
