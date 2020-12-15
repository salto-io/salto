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

export const centercategoryInnerTypes: ObjectType[] = []

const centercategoryElemID = new ElemID(constants.NETSUITE, 'centercategory')
const centercategory_links_linkElemID = new ElemID(constants.NETSUITE, 'centercategory_links_link')

const centercategory_links_link = new ObjectType({
  elemID: centercategory_links_linkElemID,
  annotations: {
  },
  fields: {
    linkid: {
      refType: createRefToElmWithValue(enums.generic_task),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the linkobject value is not defined.   For information about possible values, see generic_task. */
    linkobject: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the linkid value is not defined.   This field accepts references to the following custom types:   workflowactionscript   usereventscript   scriptdeployment   suitelet   scheduledscript   savedsearch   restlet   portlet   massupdatescript   mapreducescript   customtransactiontype   customrecordtype   clientscript   centertab   bundleinstallationscript */
    linktasktype: {
      refType: createRefToElmWithValue(enums.centercategory_tasktype),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the linkobject value is defined.   For information about possible values, see centercategory_tasktype. */
    linklabel: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    shortlist: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, centercategoryElemID.name],
})

centercategoryInnerTypes.push(centercategory_links_link)

const centercategory_linksElemID = new ElemID(constants.NETSUITE, 'centercategory_links')

const centercategory_links = new ObjectType({
  elemID: centercategory_linksElemID,
  annotations: {
  },
  fields: {
    link: {
      refType: createRefToElmWithValue(new ListType(centercategory_links_link)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, centercategoryElemID.name],
})

centercategoryInnerTypes.push(centercategory_links)


export const centercategory = new ObjectType({
  elemID: centercategoryElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custcentercategory[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custcentercategory’. */
    center: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the center custom type.   For information about other possible values, see generic_centertype. */
    centertab: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the centertab custom type.   For information about other possible values, see generic_centertab. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This field value can be up to 99 characters long.   This field accepts references to the string custom type. */
    links: {
      refType: createRefToElmWithValue(centercategory_links),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, centercategoryElemID.name],
})
