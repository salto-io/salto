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

export const savedsearchInnerTypes: ObjectType[] = []

const savedsearchElemID = new ElemID(constants.NETSUITE, 'savedsearch')
const savedsearch_dependenciesElemID = new ElemID(constants.NETSUITE, 'savedsearch_dependencies')

const savedsearch_dependencies = new ObjectType({
  elemID: savedsearch_dependenciesElemID,
  annotations: {
  },
  fields: {
    dependency: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field only accepts references to any custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedsearchElemID.name],
})

savedsearchInnerTypes.push(savedsearch_dependencies)


export const savedsearch = new ObjectType({
  elemID: savedsearchElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customsearch_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customsearch’. */
    definition: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    dependencies: {
      type: savedsearch_dependencies,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedsearchElemID.name],
})
