/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, MapType } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { JIRA } from '../../constants'
import { Trigger } from './types'

export const triggerType = createMatchingObjectType<Trigger>({
  elemID: new ElemID(JIRA, 'Trigger'),
  fields: {
    key: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    configuration: {
      refType: new MapType(BuiltinTypes.UNKNOWN),
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
  },
  path: [JIRA, elements.TYPES_PATH, 'Trigger'],
})
