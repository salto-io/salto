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
import * as transforms from './transforms'

// TODO example - adjust and remove:
// * irrelevant definitions and comments
// * unneeded function args

// Note: hiding fields inside arrays is not supported, and can result in a corrupted workspace.
// when in doubt, it's best to hide fields only for relevant types, or to omit them.
const DEFAULT_FIELDS_TO_HIDE: Record<string, definitions.fetch.ElementFieldCustomization> = {
  created_at: {
    hide: true,
  },
  updated_at: {
    hide: true,
  },
  created_by_id: {
    hide: true,
  },
  updated_by_id: {
    hide: true,
  },
}
const DEFAULT_FIELDS_TO_OMIT: Record<string, definitions.fetch.ElementFieldCustomization> = {
  _links: {
    omit: true,
  },
}

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = _.merge(
  {},
  DEFAULT_FIELDS_TO_HIDE,
  DEFAULT_FIELDS_TO_OMIT,
)

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  group: {
    requests: [
      {
        endpoint: {
          path: '/api/v2/groups',
        },
        transformation: {
          root: 'groups',
        },
      },
    ],
    resource: {
      // this type can be included/excluded based on the user's fetch query
      directFetch: true,
    },
    element: {
      topLevel: {
        // isTopLevel should be set when the workspace can have instances of this type
        isTopLevel: true,
        serviceUrl: {
          path: '/some/path/to/group/with/potential/placeholder/{id}',
        },
      },
      fieldCustomizations: {
        id: {
          fieldType: 'number',
          hide: true,
        },
      },
    },
  },

  business_hours_schedule: {
    requests: [
      {
        endpoint: {
          path: '/api/v2/business_hours/schedules',
        },
        transformation: {
          root: 'schedules',
        },
      },
    ],
    resource: {
      directFetch: true,
      // after we get the business_hour_schedule response, we make a follow-up request to get
      // the holiday and nest the response under the 'holidays' field
      recurseInto: {
        holidays: {
          typeName: 'business_hours_schedule_holiday',
          context: {
            args: {
              parent_id: {
                root: 'id',
              },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: {
          path: '/admin/objects-rules/rules/schedules',
        },
      },
      fieldCustomizations: {
        id: {
          fieldType: 'number',
          hide: true,
        },
        holidays: {
          // extract each item in the holidays field to its own instance
          standalone: {
            typeName: 'business_hours_schedule_holiday',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  business_hours_schedule_holiday: {
    requests: [
      {
        endpoint: {
          path: '/api/v2/business_hours/schedules/{parent_id}/holidays',
        },
        transformation: {
          root: 'holidays',
          adjust: transforms.transformHoliday,
        },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
      },
      fieldCustomizations: {
        id: {
          fieldType: 'number',
          hide: true,
        },
      },
    },
  },

  made_up_type_a: {
    requests: [
      {
        endpoint: {
          path: '/api/v2/made_up_type_a',
        },
        transformation: {
          root: 'made_up_type_a',
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
  made_up_type_b: {
    requests: [
      {
        endpoint: {
          path: '/api/v2/made_up_type_b',
        },
        transformation: {
          root: 'made_up_type_b',
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
          elemID: { parts: DEFAULT_ID_PARTS },
          serviceUrl: {
            // TODO put default base url for serviceUrl filter (can override for specific types in customizations)
            baseUrl: 'https://api.example.com',
          },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
