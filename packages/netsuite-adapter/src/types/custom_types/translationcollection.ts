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
import { enums } from '../enums'

export const translationcollectionInnerTypes: ObjectType[] = []

const translationcollectionElemID = new ElemID(constants.NETSUITE, 'translationcollection')
const translationcollection_strings_stringElemID = new ElemID(constants.NETSUITE, 'translationcollection_strings_string')

const translationcollection_strings_string = new ObjectType({
  elemID: translationcollection_strings_stringElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 60 characters long. */
    defaulttranslation: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 1000,
      },
    }, /* Original description: This field value can be up to 1000 characters long. */
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 1000,
      },
    }, /* Original description: This field value can be up to 1000 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, translationcollectionElemID.name],
})

translationcollectionInnerTypes.push(translationcollection_strings_string)

const translationcollection_stringsElemID = new ElemID(constants.NETSUITE, 'translationcollection_strings')

const translationcollection_strings = new ObjectType({
  elemID: translationcollection_stringsElemID,
  annotations: {
  },
  fields: {
    string: {
      type: new ListType(translationcollection_strings_string),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, translationcollectionElemID.name],
})

translationcollectionInnerTypes.push(translationcollection_strings)


export const translationcollection = new ObjectType({
  elemID: translationcollectionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custcollection[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 60 characters long.   The default value is ‘custcollection’. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 100,
      },
    }, /* Original description: This field value can be up to 100 characters long. */
    defaultlanguage: {
      type: enums.translationcollection_defaultlanguage,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see translationcollection_defaultlanguage. */
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 1000,
      },
    }, /* Original description: This field value can be up to 1000 characters long. */
    strings: {
      type: translationcollection_strings,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, translationcollectionElemID.name],
})
