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
import { Options } from '../types'
import { Credentials } from '../../auth'

// Note: hiding fields inside arrays is not supported, and can result in a corrupted workspace.
// when in doubt, it's best to hide fields only for relevant types, or to omit them.
const DEFAULT_FIELDS_TO_HIDE: Record<string, definitions.fetch.ElementFieldCustomization> = {
  created_at: {
    hide: true,
  },
  updated_at: {
    hide: true,
  },
  // type: {
  //   hide: true,
  // },
}
const DEFAULT_FIELDS_TO_OMIT: Record<string, definitions.fetch.ElementFieldCustomization> = {
  self: {
    omit: true,
  },
  html_url: {
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
  service: {
    requests: [
      {
        endpoint: {
          path: '/services',
        },
        transformation: {
          root: 'services',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/services/{id}' },
      },
    },
  },
  businessService: {
    requests: [
      {
        endpoint: {
          path: '/business_services',
        },
        transformation: {
          root: 'business_services',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/business_services/{id}' },
      },
    },
  },
  team: {
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
        serviceUrl: { path: '/teams/{id}' },
      },
    },
  },
  escalationPolicy: {
    requests: [
      {
        endpoint: {
          path: '/escalation_policies',
        },
        transformation: {
          root: 'escalation_policies',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/escalation_policies/{id}' },
      },
      fieldCustomizations: {
        services: {
          omit: true,
        },
      },
    },
  },
  schedule: {
    requests: [
      {
        endpoint: {
          path: '/schedules',
          queryArgs: {
            'include[]': 'schedule_layers',
          },
        },
        transformation: {
          root: 'schedules',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/schedules/{id}' },
      },
      fieldCustomizations: {
        escalation_policies: {
          omit: true,
        },
      },
    },
  },
})

export const createFetchDefinitions = (credentials: Credentials): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
      },
      element: {
        topLevel: {
          elemID: { parts: DEFAULT_ID_PARTS },
          serviceUrl: { baseUrl: credentials.subdomain },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
