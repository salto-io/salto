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
import { ZendeskConfig } from '../../config'
import { ZendeskFetchOptions } from '../types'
import * as transforms from './transforms'

// TODO example - adjust and remove:
// * irrelevant definitions and comments
// * unneeded function args

// Note: hiding fields inside arrays is not supported, and can result in a corrupted workspace.
// when in doubt, it's best to hide fields only for relevant types, or to omit them.
const DEFAULT_FIELDS_TO_HIDE: Record<string, definitions.fetch.ElementFieldCustomization> = {
  created_at: { hide: true },
  updated_at: { hide: true },
  created_by_id: { hide: true },
  updated_by_id: { hide: true },
}
const DEFAULT_FIELDS_TO_OMIT: Record<string, definitions.fetch.ElementFieldCustomization> = {
  count: { omit: true },
  url: { omit: true },
  extended_output_schema: { omit: true },
  extended_input_schema: { omit: true },
}

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = _.merge(
  {},
  DEFAULT_FIELDS_TO_HIDE,
  DEFAULT_FIELDS_TO_OMIT,
)

const createCustomizations = (): Record<
  string,
  definitions.fetch.InstanceFetchApiDefinitions<ZendeskFetchOptions>
> => ({
  group: {
    requests: [
      {
        endpoint: { path: '/api/v2/groups' },
        transformation: { root: 'groups' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/people/team/groups/{id}' },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
      },
    },
  },
  custom_role: {
    requests: [
      {
        endpoint: { path: '/api/v2/custom_roles' },
        transformation: { root: 'custom_roles' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/people/team/roles/{id}' },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        // always 0 - https://developer.zendesk.com/api-reference/ticketing/account-configuration/custom_roles/#json-format
        role_type: { omit: true },
        team_member_count: { omit: true },
      },
    },
  },
  organization: {
    requests: [
      {
        endpoint: { path: '/api/v2/organizations' },
        transformation: { root: 'organizations' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/agent/organizations/{id}/tickets' },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        organization_fields: { fieldType: 'map<unknown>' },
      },
    },
  },

  view: {
    requests: [
      {
        endpoint: { path: '/api/v2/views' },
        transformation: { root: 'views' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/workspaces/agent-workspace/views/{id}' },
        elemID: { parts: [{ fieldName: 'title' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'title' }] }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        title: { hide: true },
      },
    },
  },

  view__restriction: {
    element: {
      fieldCustomizations: {
        id: { fieldType: 'unknown' },
        type: { fieldType: 'string', restrictions: { enforce_value: true, values: ['Group', 'User'] } },
      },
    },
  },

  trigger: {
    requests: [
      {
        endpoint: { path: '/api/v2/triggers' },
        transformation: { root: 'triggers' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/rules/triggers/{id}' },
        elemID: { parts: [{ fieldName: 'title' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'title' }] }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
      },
    },
  },

  trigger__conditions__all: {
    element: {
      fieldCustomizations: {
        is_user_value: { fieldType: 'boolean' },
      },
    },
  },

  trigger__conditions__any: {
    element: {
      fieldCustomizations: {
        is_user_value: { fieldType: 'boolean' },
      },
    },
  },

  trigger_category: {
    requests: [
      {
        endpoint: { path: '/api/v2/trigger_categories' },
        transformation: { root: 'trigger_categories' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/rules/triggers' },
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'string', hide: true },
      },
    },
  },

  trigger_definition: {
    requests: [
      {
        endpoint: { path: '/api/v2/triggers/definitions' },
        transformation: { root: 'definitions' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/rules/automations/{id}' },
        elemID: { parts: [{ fieldName: 'title' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'title' }] }] },
        singleton: true,
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
      },
    },
  },

  automation: {
    requests: [
      {
        endpoint: { path: '/api/v2/automations' },
        transformation: { root: 'automations' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/rules/automations/{id}' },
        elemID: { parts: [{ fieldName: 'title' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'title' }] }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
      },
    },
  },

  target: {
    requests: [
      {
        endpoint: { path: '/api/v2/targets' },
        transformation: { root: 'targets' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/apps-integrations/targets/targets' },
        elemID: { parts: [{ fieldName: 'title' }, { fieldName: 'type' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'title' }] }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
      },
    },
  },

  sla_policy: {
    requests: [
      {
        endpoint: { path: '/api/v2/slas/policies' },
        transformation: { root: 'sla_policies' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/rules/slas' },
        elemID: { parts: [{ fieldName: 'title' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'title' }] }] },
      },
      fieldCustomizations: { id: { fieldType: 'number', hide: true } },
    },
  },

  sla_policy__filter__all: {
    // value can be number or string
    element: { fieldCustomizations: { value: { fieldType: 'unknown' } } },
  },

  sla_policy__filter__any: {
    // value can be number or string
    element: { fieldCustomizations: { value: { fieldType: 'unknown' } } },
  },

  sla_policies_definition: {
    requests: [
      {
        endpoint: { path: '/api/v2/slas/policies/definitions' },
        transformation: { root: 'value' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
      },
      fieldCustomizations: { id: { hide: true } },
    },
  },

  macro: {
    requests: [
      {
        endpoint: { path: '/api/v2/macros', queryArgs: { access: 'shared' } },
        transformation: { root: 'macros' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/workspaces/agent-workspace/macros/{id}' },
        elemID: { parts: [{ fieldName: 'title' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'title' }] }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        position: { omit: true },
      },
    },
  },

  macro_attachment: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'fileName' }] },
      },
      fieldCustomizations: { id: { fieldType: 'number', hide: true } },
    },
  },

  macro_action: {
    requests: [
      {
        endpoint: { path: '/api/v2/macros/actions' },
        transformation: { root: '.' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
      },
    },
  },

  macro_category: {
    requests: [
      {
        endpoint: { path: '/api/v2/macros/categories' },
        transformation: { root: 'categories' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
      },
    },
  },

  macros_definitions: {
    requests: [
      {
        endpoint: { path: '/api/v2/macros/definitions' },
        transformation: { root: 'definitions' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
      },
    },
  },
  macro__restriction: {
    element: { fieldCustomizations: { id: { fieldType: 'unknown' } } },
  },

  brand: {
    requests: [
      {
        endpoint: { path: '/api/v2/brands' },
        transformation: { root: 'brands' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/account/brand_management/brands' },
      },
      fieldCustomizations: {
        ticket_form_ids: { omit: true },
        id: { fieldType: 'number', hide: true },
        help_center_state: {
          fieldType: 'number',
          restrictions: {
            enforce_value: true,
            values: ['enabled', 'disabled', 'restricted'],
          },
        },
        categories: { fieldType: 'list<category>' },
      },
    },
  },

  locale: {
    requests: [
      {
        endpoint: { path: '/api/v2/locales' },
        transformation: { root: 'locales' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'locale' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'locale' }] }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'number' },
        default: { hide: true },
      },
    },
  },

  sharing_agreement: {
    requests: [
      {
        endpoint: { path: '/api/v2/sharing_agreements' },
        transformation: { root: 'sharing_agreements' },
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
        id: { fieldType: 'number', hide: true },
        status: {
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            values: ['accepted', 'declined', 'pending', 'inactive'],
          },
        },
        type: {
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            values: ['accepted', 'declined', 'pending', 'inactive'],
          },
        },
      },
    },
  },

  support_address: {
    requests: [
      {
        endpoint: { path: '/api/v2/recipient_addresses' },
        transformation: { root: 'recipient_addresses' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'name' }, { fieldName: 'email', isReference: true }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        cname_status: {
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            values: ['unknown', 'verified', 'failed'],
          },
        },
        dns_results: {
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            values: ['verified', 'failed'],
          },
        },
        domain_verification_status: {
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            values: ['unknown', 'verified', 'failed'],
          },
        },
        forwarding_status: {
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            values: ['unknown', 'waiting', 'verified', 'failed'],
          },
        },
        spf_status: {
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            values: ['unknown', 'verified', 'failed'],
          },
        },
        username: { fieldType: 'string', hide: true },
        //      idFields: ['name', '&email'],
        //      fileNameFields: ['locale'],
      },
    },
  },

  business_hours_schedule: {
    requests: [
      {
        endpoint: { path: '/api/v2/business_hours/schedules' },
        transformation: { root: 'schedules' },
      },
    ],
    resource: {
      directFetch: true,
      // after we get the business_hour_schedule response, we make a follow-up request to get
      // the holiday and nest the response under the 'holidays' field
      recurseInto: {
        holidays: {
          typeName: 'business_hours_schedule_holiday',
          context: { args: { parent_id: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/rules/schedules' },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        holidays: {
          // extract each item in the holidays field to its own instance
          standalone: {
            typeName: 'business_hours_schedule_holiday',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  business_hours_schedule_holiday: {
    requests: [
      {
        endpoint: { path: '/api/v2/business_hours/schedules/{parent_id}/holidays' },
        transformation: { root: 'holidays', adjust: transforms.transformHoliday },
      },
    ],
    element: {
      topLevel: { isTopLevel: true, elemID: { extendsParent: true } },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        start_year: { fieldType: 'string', hide: true },
        end_year: { fieldType: 'string', hide: true },
      },
    },
  },
})

export const createFetchDefinitions = (
  _fetchConfig: ZendeskConfig,
): definitions.fetch.FetchApiDefinitions<ZendeskFetchOptions> => ({
  instances: {
    default: {
      resource: { serviceIDFields: ['id'] },
      element: {
        topLevel: { elemID: { parts: DEFAULT_ID_PARTS } },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
