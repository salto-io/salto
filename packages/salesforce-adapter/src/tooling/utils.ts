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
import { CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import {
  TOOLING_PATH,
  ToolingObjectAnnotation,
} from './constants'
import { SupportedToolingObjectName, ToolingField, ToolingObjectType } from './types'
import { API_NAME, SALESFORCE } from '../constants'

export const createToolingObject = (
  objectName: SupportedToolingObjectName,
  fields: ToolingObjectType['fields'] = {}
): ToolingObjectType => (
  Object.assign(
    new ObjectType({
      elemID: new ElemID(SALESFORCE, objectName),
      annotations: {
        [CORE_ANNOTATIONS.CREATABLE]: false,
        [CORE_ANNOTATIONS.UPDATABLE]: false,
        [CORE_ANNOTATIONS.DELETABLE]: false,
      },
    }),
    {
      path: [...TOOLING_PATH, objectName] as const,
      annotations: {
        [API_NAME]: objectName,
        [ToolingObjectAnnotation.isToolingObject]: true as const,
      },
      fields,
    }
  )
)


export const toolingObjectApiName = (toolingObject: ToolingObjectType): SupportedToolingObjectName => (
  toolingObject.annotations[API_NAME]
)

export const toolingFieldApiName = (toolingField: ToolingField): string => (
  toolingField.annotations[API_NAME]
)
