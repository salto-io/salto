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
import { InstanceElement } from '@salto-io/adapter-api'
import { ESCALATION_POLICY_TYPE_NAME, SCHEDULE_LAYERS_TYPE_NAME, SCHEDULE_TYPE_NAME, USER_TYPE_NAME } from './constants'
import { DEFAULT_ID_PARTS } from './definitions/fetch/fetch'

export const USER_FETCH_DEFINITIONS = {
  customizations: {
    [USER_TYPE_NAME]: {
      requests: [
        {
          endpoint: {
            path: '/users',
          },
          transformation: {
            root: 'users',
          },
        },
      ],
      resource: {
        directFetch: true,
        serviceIDFields: ['id'],
      },
      element: {
        topLevel: {
          isTopLevel: true,
          elemID: { parts: DEFAULT_ID_PARTS },
        },
      },
    },
  },
}

export const isRelevantInstanceForFetch = (instance: InstanceElement): boolean => {
  if (
    instance.elemID.typeName === SCHEDULE_LAYERS_TYPE_NAME ||
    instance.elemID.typeName === ESCALATION_POLICY_TYPE_NAME
  ) {
    return true
  }
  return false
}

export const isRelevantInstance = (instance: InstanceElement): boolean => {
  if (isRelevantInstanceForFetch(instance) || instance.elemID.typeName === SCHEDULE_TYPE_NAME) {
    return true
  }
  return false
}
