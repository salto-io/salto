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

import { EndpointPath } from '../../types'
import { DEFAULT_TRANSFORMATION, ID_FIELD_TO_HIDE } from '../constants'
import { FetchApiDefinition } from '../types'

export const createDefinitionForAppRoleAssignment = (parentResourceName: string): FetchApiDefinition => ({
  requests: [
    {
      endpoint: {
        path: `/${parentResourceName}/{id}/appRoleAssignments` as EndpointPath,
      },
      transformation: {
        ...DEFAULT_TRANSFORMATION,
        pick: ['id', 'appRoleId', 'resourceId'],
      },
    },
  ],
  element: {
    topLevel: {
      isTopLevel: true,
      elemID: {
        extendsParent: true,
        parts: [
          { fieldName: 'appRoleId', isReference: true },
          { fieldName: 'resourceId', isReference: true },
        ],
      },
    },
    fieldCustomizations: ID_FIELD_TO_HIDE,
  },
})
