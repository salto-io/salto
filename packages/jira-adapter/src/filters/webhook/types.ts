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
import { JIRA, WEBHOOK_TYPE } from '../../constants'

export const createWebhookTypes = (): {
  webhookType: ObjectType
  subTypes: ObjectType[]
} => {
  const filtersType = new ObjectType({
    elemID: new ElemID(JIRA, 'WebhookFilters'),
    fields: {
      issue_related_events_section: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        },
      },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'WebhookFilters'],
  })

  const webhookType = new ObjectType({
    elemID: new ElemID(JIRA, WEBHOOK_TYPE),
    fields: {
      id: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        },
      },
      name: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        },
      },
      url: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        },
      },
      excludeBody: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: {
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        },
      },
      filters: {
        refType: filtersType,
        annotations: {
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        },
      },
      events: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        },
      },
      enabled: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: {
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        },
      },
    },
    path: [JIRA, elements.TYPES_PATH, WEBHOOK_TYPE],
    annotations: {
      [CORE_ANNOTATIONS.CREATABLE]: true,
      [CORE_ANNOTATIONS.UPDATABLE]: true,
      [CORE_ANNOTATIONS.DELETABLE]: true,
    },
  })

  return {
    webhookType,
    subTypes: [filtersType],
  }
}
