/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { JIRA, PRIORITY_SCHEME_TYPE_NAME } from '../../../constants'

export const createPrioritySchemeType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(JIRA, PRIORITY_SCHEME_TYPE_NAME),
    fields: {
      id: {
        refType: BuiltinTypes.SERVICE_ID_NUMBER,
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
      },
      name: { refType: BuiltinTypes.STRING },
      description: { refType: BuiltinTypes.STRING },
      defaultOptionId: { refType: BuiltinTypes.STRING },
      defaultScheme: { refType: BuiltinTypes.BOOLEAN },
      optionIds: { refType: new ListType(BuiltinTypes.STRING) },
    },
    path: [JIRA, elements.TYPES_PATH, PRIORITY_SCHEME_TYPE_NAME],
  })
