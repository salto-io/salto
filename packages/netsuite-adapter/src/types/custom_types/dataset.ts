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
import * as constants from '../../constants'
import { fieldTypes } from '../field_types'

export const datasetInnerTypes: ObjectType[] = []

const datasetElemID = new ElemID(constants.NETSUITE, 'dataset')
const dataset_dependenciesElemID = new ElemID(constants.NETSUITE, 'dataset_dependencies')

const dataset_dependencies = new ObjectType({
  elemID: dataset_dependenciesElemID,
  annotations: {
  },
  fields: {
    dependency: {
      type: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customtransactiontype   customsegment   customrecordcustomfield   customrecordtype   crmcustomfield */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, datasetElemID.name],
})

datasetInnerTypes.push(dataset_dependencies)


export const dataset = new ObjectType({
  elemID: datasetElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custdataset[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custdataset’. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
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
      type: dataset_dependencies,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, datasetElemID.name],
})
