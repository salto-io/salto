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
import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { UserFetchConfig } from '../../config'
import { Options } from '../types'
import { mapArrayFieldToNestedValues, replaceFieldWithNestedValue } from './transforms'

const DEFAULT_FIELDS_TO_HIDE: Record<string, definitions.fetch.ElementFieldCustomization> = {
  created_by_id: {
    hide: true,
  },
  updated_by_id: {
    hide: true,
  },
  id: {
    hide: true,
  },
}
const DEFAULT_FIELDS_TO_OMIT: Record<string, definitions.fetch.ElementFieldCustomization> = {
  _links: {
    omit: true,
  },
  created_at: {
    omit: true,
  },
  updated_at: {
    omit: true,
  },
  workspace_id: {
    omit: true,
  },
}

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = _.merge(
  {},
  DEFAULT_FIELDS_TO_HIDE,
  DEFAULT_FIELDS_TO_OMIT,
)

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  article: {
    // TODO SALTO-5768: translate author_id to author mail
    // TODO SALTO-5768: create service url from url field
    requests: [
      {
        endpoint: {
          path: '/articles',
        },
        transformation: {
          root: 'data',
          omit: ['parent_ids'],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            {
              fieldName: 'parent_id',
              isReference: true,
            },
            {
              fieldName: 'title',
            },
          ],
        },
        alias: {
          aliasComponents: [{ fieldName: 'title' }],
        },
      },
    },
  },
  collection: {
    // TODO SALTO-5768: nest under their parent dir?
    // TODO SALTO-5768: nest all collections under the help center they're in?
    requests: [
      {
        endpoint: {
          path: '/help_center/collections',
        },
        transformation: {
          root: 'data',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            {
              fieldName: 'parent_id',
              isReference: true,
            },
            NAME_ID_FIELD,
          ],
        },
        alias: {
          aliasComponents: [NAME_ID_FIELD],
        },
      },
    },
  },
  company: {
    // TODO SALTO-5768: actively remove results that have no company name?
    requests: [
      {
        endpoint: {
          path: '/companies/scroll',
        },
        transformation: {
          root: 'data',
          // app_id is always the same as the account_id
          omit: ['app_id', 'remote_created_at', 'created_at', 'updated_at', 'last_request_at'],
          adjust: mapArrayFieldToNestedValues([
            { fieldName: 'tags', fromField: 'tags', nestedField: 'id', fallbackValue: '' },
            { fieldName: 'segments', fromField: 'segments', nestedField: 'id', fallbackValue: '' },
          ]),
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        company_id: {
          hide: true,
        },
        app_id: {
          hide: true,
        },
      },
    },
  },
  data_attribute: {
    // TODO SALTO-5768: translate admin_id to admin mail
    requests: [
      {
        endpoint: {
          path: '/data_attributes',
        },
        transformation: {
          root: 'data',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'full_name' }],
        },
      },
    },
  },
  help_center: {
    requests: [
      {
        endpoint: {
          path: '/help_center/help_centers',
        },
        transformation: {
          root: 'data',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'identifier' }],
        },
      },
    },
  },
  news_item: {
    // TODO SALTO-5768: translate sender_id to sender mail
    requests: [
      {
        endpoint: {
          path: '/news/news_items',
        },
        transformation: {
          root: 'data',
          adjust: mapArrayFieldToNestedValues([
            {
              fieldName: 'newsfeed_assignments',
              nestedField: 'newsfeed_id',
              fallbackValue: '',
            },
          ]),
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'title' }],
        },
      },
    },
  },
  newsfeed: {
    requests: [
      {
        endpoint: {
          path: '/news/newsfeeds',
        },
        transformation: {
          root: 'data',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
    },
  },
  segment: {
    requests: [
      {
        endpoint: {
          path: '/segments',
        },
        transformation: {
          root: 'segments',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
    },
  },
  subscription_type: {
    requests: [
      {
        endpoint: {
          path: '/subscription_types',
        },
        transformation: {
          root: 'data',
          adjust: replaceFieldWithNestedValue({
            fieldName: 'default_translation',
            nestedField: 'name',
            fallbackValue: '',
          }),
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'consent_type' }, { fieldName: 'default_translation' }],
        },
      },
      fieldCustomizations: {
        translations: {
          standalone: {
            typeName: 'subscription_type_translation',
            addParentAnnotation: false,
            nestPathUnderParent: true,
            referenceFromParent: true,
          },
        },
      },
    },
  },
  tag: {
    requests: [
      {
        endpoint: {
          path: '/tags',
        },
        transformation: {
          root: 'data',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
    },
  },
  team: {
    // TODO SALTO-5768: translate admin_ids to admin mails
    requests: [
      {
        endpoint: {
          path: '/teams',
        },
        transformation: {
          root: 'teams',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
    },
  },
  ticket_type: {
    requests: [
      {
        endpoint: {
          path: '/ticket_types',
        },
        transformation: {
          root: 'data',
          adjust: replaceFieldWithNestedValue({
            fieldName: 'ticket_type_attributes',
            nestedField: 'data',
            fallbackValue: [],
          }),
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        ticket_type_attributes: {
          standalone: {
            typeName: 'ticket_type_attribute',
            addParentAnnotation: false,
            nestPathUnderParent: true,
            referenceFromParent: true,
          },
        },
      },
    },
  },

  // Non direct fetch
  subscription_type_translation: {
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
    },
  },
  ticket_type_attribute: {
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            {
              fieldName: 'ticket_type_id',
              isReference: true,
            },
            NAME_ID_FIELD,
          ],
        },
      },
    },
  },
})

export const createFetchDefinitions = (
  _fetchConfig: UserFetchConfig,
): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
      },
      element: {
        topLevel: {
          elemID: { parts: [NAME_ID_FIELD] },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
