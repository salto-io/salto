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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const subtabInnerTypes: ObjectType[] = []

const subtabElemID = new ElemID(constants.NETSUITE, 'subtab')

export const subtab = new ObjectType({
  elemID: subtabElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custtab_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custtab’. */
    title: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    tabtype: {
      type: enums.generic_tab_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_tab_type. */
    parent: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type.   For information about other possible values, see generic_tab_parent. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, subtabElemID.name],
})
