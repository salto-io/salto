/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ListType, ObjectType } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import { ACCOUNT_ID_INFO_TYPE, JIRA } from '../../constants'

export const accountIdInfoType = new ObjectType({
  elemID: new ElemID(JIRA, ACCOUNT_ID_INFO_TYPE),
  fields: {
    id: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      },
    },
    displayName: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      },
    },
  },
  path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, ACCOUNT_ID_INFO_TYPE],
})

export const accountIdInfoListType = new ListType(accountIdInfoType)
