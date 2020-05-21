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

export const customlistInnerTypes: ObjectType[] = []

const customlistElemID = new ElemID(constants.NETSUITE, 'customlist')
const customlist_customvalues_customvalueElemID = new ElemID(constants.NETSUITE, 'customlist_customvalues_customvalue')

const customlist_customvalues_customvalue = new ObjectType({
  elemID: customlist_customvalues_customvalueElemID,
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
    value: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    abbreviation: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the ismatrixoption value is equal to T.   If this field appears in the project, you must reference the MATRIXITEMS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MATRIXITEMS must be enabled for this field to appear in your account. */
    isinactive: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
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
    customvalue: {
      type: new ListType(customlist_customvalues_customvalue),
      annotations: {
      },
    },
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
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 38 characters long.   The default value is ‘customlist’. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 30,
      },
    }, /* Original description: This field value can be up to 30 characters long. */
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    isinactive: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    ismatrixoption: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the MATRIXITEMS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MATRIXITEMS must be enabled for this field to appear in your account. */
    isordered: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    customvalues: {
      type: customlist_customvalues,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customlistElemID.name],
})
