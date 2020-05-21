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
import { fieldTypes } from '../field_types'

export const workbookInnerTypes: ObjectType[] = []

const workbookElemID = new ElemID(constants.NETSUITE, 'workbook')
const workbook_dependenciesElemID = new ElemID(constants.NETSUITE, 'workbook_dependencies')

const workbook_dependencies = new ObjectType({
  elemID: workbook_dependenciesElemID,
  annotations: {
  },
  fields: {
    dependency: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the dataset custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
})

workbookInnerTypes.push(workbook_dependencies)


export const workbook = new ObjectType({
  elemID: workbookElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custworkbook_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custworkbook’. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 50,
      },
    }, /* Original description: This field value can be up to 50 characters long. */
    definition: {
      type: fieldTypes.cdata,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    dependencies: {
      type: workbook_dependencies,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
})
