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
import { EVERYONE_USER_TYPE } from '../../constants'

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

  // placeholder for order nacls
  view_order: {},

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

  // placeholder for order nacls
  trigger_order: {},

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

  // placeholder for order nacls
  automation_order: {},

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
    resource: { directFetch: false },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
      },
      fieldCustomizations: { id: { hide: true } },
    },
  },

  // placeholder for order nacls
  sla_policy_order: {},

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

  macro_categories: {
    requests: [
      {
        endpoint: { path: '/api/v2/macros/categories' },
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
        categories: { fieldType: 'list<string>' },
      },
    },
  },

  macro__restriction: {
    element: { fieldCustomizations: { id: { fieldType: 'unknown' } } },
  },

  ticket_form: {
    requests: [
      {
        endpoint: { path: '/api/v2/ticket_forms' },
        transformation: { root: 'ticket_forms' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/tickets/ticket-forms/edit/{id}' },
      },
      fieldCustomizations: {
        name: { hide: true },
        id: { fieldType: 'number', hide: true },
        display_name: { omit: true },
      },
    },
  },

  // placeholder for order nacls
  ticket_form_order: {},

  custom_status: {
    requests: [
      {
        endpoint: { path: '/api/v2/custom_statuses' },
        transformation: { root: 'custom_statuses' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/tickets/ticket_statuses/edit/{id}' },
        elemID: { parts: [{ fieldName: 'status_category' }, { fieldName: 'raw_agent_label' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'status_category' }, { fieldName: 'raw_agent_label' }] }] },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        end_user_label: { hide: true },
        agent_label: { hide: true },
        description: { hide: true },
        end_user_description: { hide: true },
        default: { hide: true },
      },
    },
  },

  ticket_field: {
    requests: [
      {
        endpoint: { path: '/api/v2/ticket_fields' },
        transformation: { root: 'ticket_fields' },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        value: {
          typeName: 'ticket_field__custom_field_options',
          context: { args: { parent_id: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/tickets/ticket-fields/{id}' },
        elemID: { parts: [{ fieldName: 'raw_title' }, { fieldName: 'type' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'raw_title' }, { fieldName: 'type' }] }] },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        title: { hide: true },
        position: { omit: true },
        description: { omit: true },
        title_in_portal: { omit: true },
        // TODO may want to add back as part of SALTO-2895
        custom_statuses: { omit: true },
        custom_field_options: {
          standalone: {
            typeName: 'ticket_field__custom_field_options',
            addParentAnnotation: true,
            nestPathUnderParent: false,
            referenceFromParent: true,
          },
        },
      },
    },
  },

  ticket_field__custom_field_options: {
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'value' }], extendsParent: true, useOldFormat: true },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        name: { omit: true },
        value: {
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            // this regex will not allow the following characters to be in the string:
            // & % $ # @ ! { } [ ] = + ( ) * ? < > , " ' ` ; \
            regex: '^[^&%$#@\\! \\{\\}\\[\\]=\\+\\(\\)\\*\\?<>,"\'`;\\\\]+$',
          },
        },
      },
    },
  },

  user_field: {
    requests: [
      {
        endpoint: { path: '/api/v2/user_fields' },
        transformation: { root: 'user_fields' },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        value: {
          typeName: 'user_field__custom_field_options',
          context: { args: { parent_id: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/agent/admin/user_fields/{id}' },
        elemID: { parts: [{ fieldName: 'key' }] },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        type: { fieldType: 'string' },
        title: { hide: true },
        description: { omit: true },
        custom_field_options: {
          standalone: {
            typeName: 'user_field__custom_field_options',
            addParentAnnotation: true,
            nestPathUnderParent: false,
            referenceFromParent: true,
          },
        },
      },
    },
  },

  user_field__custom_field_options: {
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'value' }], extendsParent: true },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        default: { hide: true },
        name: { omit: true },
      },
    },
  },

  // placeholder for order nacls
  user_field_order: {},

  organization_field: {
    requests: [
      {
        endpoint: { path: '/api/v2/organization_fields' },
        transformation: { root: 'organization_fields' },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        value: {
          typeName: 'organization_field__custom_field_options',
          context: { args: { parent_id: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/agent/admin/organization_fields/{id}' },
        elemID: { parts: [{ fieldName: 'key' }] },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        type: { fieldType: 'string' },
        title: { hide: true },
        description: { omit: true },
        custom_field_options: {
          standalone: {
            typeName: 'organization_field__custom_field_options',
            addParentAnnotation: true,
            nestPathUnderParent: false,
            referenceFromParent: true,
          },
        },
      },
    },
  },

  organization_field__custom_field_options: {
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'value' }], extendsParent: true },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        name: { omit: true },
      },
    },
  },

  // placeholder for order nacls
  organization_field_order: {},

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
          fieldType: 'string',
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

  app_installation: {
    requests: [
      {
        endpoint: { path: '/api/v2/apps/installations' },
        transformation: { root: 'installations' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/apps-integrations/apps/support-apps' },
        elemID: { parts: [{ fieldName: 'settings.name' }, { fieldName: 'product' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'settings.name' }, { fieldName: 'product' }] }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        updated: { omit: true },
      },
    },
  },

  app_owned: {
    requests: [
      {
        endpoint: { path: '/api/v2/apps/owned' },
        transformation: { root: 'apps' },
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
        id: { hide: true, fieldType: 'number' },
        parameters: { fieldType: 'map<app_owned__parameters>' },
      },
    },
  },

  app_owned__parameters: {
    resource: { directFetch: true },
    element: {
      topLevel: { isTopLevel: true },
      fieldCustomizations: { id: { hide: true }, app_id: { hide: true } },
    },
  },

  oauth_client: {
    requests: [
      {
        endpoint: { path: '/api/v2/oauth/clients' },
        transformation: { root: 'clients' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/apps-integrations/apis/zendesk-api/oauth_clients' },
        elemID: { parts: [{ fieldName: 'identifier' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        secret: { hide: true, fieldType: 'string' },
        user_id: { hide: true, fieldType: 'number' },
      },
    },
  },

  oauth_global_client: {
    requests: [
      {
        endpoint: { path: '/api/v2/oauth/global_clients' },
        transformation: { root: 'global_clients' },
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
        id: { hide: true, fieldType: 'number' },
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
            values: ['inbound', 'outbound'],
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
      },
    },
  },

  account_setting: {
    requests: [
      {
        endpoint: { path: '/api/v2/account/settings' },
        transformation: { root: 'settings' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
      },
    },
  },

  account_setting__localization: {
    element: {
      fieldCustomizations: {
        locale_ids: { hide: true },
      },
    },
  },

  resource_collection: {
    requests: [
      {
        endpoint: { path: '/api/v2/resource_collections' },
        transformation: { root: 'resource_collections' },
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
        id: { hide: true, fieldType: 'number' },
      },
    },
  },

  monitored_twitter_handle: {
    requests: [
      {
        endpoint: { path: '/api/v2/channels/twitter/monitored_twitter_handles' },
        transformation: { root: 'monitored_twitter_handles' },
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
        id: { hide: true, fieldType: 'number' },
      },
    },
  },

  // placeholder for config validation (the type is created by a filter)
  tag: {
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
      },
    },
  },

  dynamic_content_item: {
    requests: [
      {
        endpoint: { path: '/api/v2/dynamic_content/items' },
        transformation: { root: 'items' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/workspaces/agent-workspace/dynamic_content' },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        outdated: { hide: true, fieldType: 'boolean' },
        variants: {
          standalone: {
            typeName: 'dynamic_content_item__variants',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },

  dynamic_content_item__variants: {
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'locale_id', isReference: true }], extendsParent: true },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        outdated: { hide: true, fieldType: 'boolean' },
      },
    },
  },

  webhook: {
    requests: [
      {
        endpoint: { path: '/api/v2/webhooks' },
        transformation: { root: 'webhooks' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/apps-integrations/webhooks/webhooks/{id}/details' },
      },
      fieldCustomizations: {
        meta: { omit: true },
        id: { hide: true, fieldType: 'string' },
        created_by: { hide: true },
        updated_by: { hide: true },
      },
    },
  },

  oauth_token: {
    requests: [
      {
        endpoint: { path: '/api/v2/oauth/tokens' },
        transformation: { root: 'tokens' },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/apps-integrations/apis/zendesk-api/oauth_clients' },
        // note: requires oauth_global_client to be included in the config
        elemID: { parts: [{ fieldName: 'client_id', isReference: true }, { fieldName: 'token' }] },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        created_at: { hide: false },
      },
    },
  },

  // SALTO-2177 token-related types that can optionally be supported - but are not included under supportedTypes yet
  api_token: {
    requests: [
      {
        endpoint: { path: '/api/v2/api_tokens' },
        transformation: { root: 'api_tokens' },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/apps-integrations/apis/zendesk-api/settings/tokens/' },
        elemID: { parts: [{ fieldName: 'description' }] },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        created_at: { hide: false },
      },
    },
  },

  custom_object: {
    requests: [
      {
        endpoint: { path: '/api/v2/custom_objects' },
        transformation: { root: 'custom_objects' },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        custom_object_fields: {
          typeName: 'custom_object_field',
          context: { args: { custom_object_key: { root: 'key' } } },
        },
      },
      serviceIDFields: [],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'key' }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'number' },
        created_by_user_id: { hide: true },
        updated_by_user_id: { hide: true },
        // these fields are generated by their raw_ counterparts, and we create them on preDeploy
        title: { omit: true },
        title_pluralized: { omit: true },
        description: { omit: true },
        custom_object_fields: {
          standalone: {
            typeName: 'custom_object_field',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },

  custom_object_field: {
    requests: [
      {
        endpoint: { path: '/api/v2/custom_objects/{custom_object_key}/fields' },
        transformation: { root: 'custom_object_fields' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true, parts: [{ fieldName: 'key' }] },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        // these fields are generated by their raw_ counterparts, and we create them on preDeploy
        title: { omit: true },
        description: { omit: true },
        custom_field_options: {
          standalone: {
            typeName: 'custom_object_field__custom_field_options',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },

  // Created in custom_object_fields_options.ts
  custom_object_field__custom_field_options: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'value' }], extendsParent: true },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
      },
    },
  },

  account_features: {
    requests: [{ endpoint: { path: '/api/v2/account/features' }, transformation: { root: 'features' } }],
    resource: { directFetch: true },
    element: { topLevel: { isTopLevel: true, singleton: true } },
  },

  routing_attribute: {
    requests: [
      {
        endpoint: { path: '/api/v2/routing/attributes' },
        transformation: { root: 'attributes' },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        values: {
          typeName: 'routing_attribute_value',
          context: { args: { attributeId: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/rules/routing' },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'string' },
        values: {
          standalone: {
            typeName: 'routing_attribute_value',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },

  routing_attribute_value: {
    requests: [
      {
        endpoint: { path: '/api/v2/routing/attributes/{attributeId}/values' },
        transformation: { root: 'attribute_values' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        serviceUrl: { path: '/admin/objects-rules/rules/routing' },
      },
      fieldCustomizations: { id: { hide: true, fieldType: 'string' } },
    },
  },

  workspace: {
    requests: [
      {
        endpoint: { path: '/api/v2/workspaces' },
        transformation: { root: 'workspaces' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'title' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'title' }] }] },
        serviceUrl: { path: '/admin/workspaces/agent-workspace/contextual-workspaces' },
      },
      fieldCustomizations: { id: { hide: true, fieldType: 'number' } },
    },
  },

  workspace__selected_macros: {
    element: { fieldCustomizations: { usage_7d: { omit: true } } },
  },

  workspace__selected_macros__restriction: {
    element: { fieldCustomizations: { id: { fieldType: 'unknown' } } },
  },

  workspace__apps: {},

  // placeholder for order nacls
  workspace_order: {},

  permission_group: {
    requests: [
      {
        endpoint: { path: '/api/v2/guide/permission_groups' },
        transformation: { root: 'permission_groups' },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/knowledge/permissions/{id}' },
      },
      fieldCustomizations: { id: { hide: true, fieldType: 'number' } },
    },
  },

  user_segment: {
    requests: [
      {
        endpoint: { path: '/api/v2/help_center/user_segments' },
        transformation: { root: 'user_segments' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/knowledge/user_segments/edit/{id}' },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        // list items can be user IDs (number) or user email (string)
        added_user_ids: { fieldType: 'List<unknown>' },
        // list items can be organization IDs (number) or organization names (email)
        organization_ids: { fieldType: 'List<unknown>' },
        // everyone user type is added as a type we created for user_segment
        user_type: {
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['signed_in_users', 'staff', EVERYONE_USER_TYPE] },
        },
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
            nestPathUnderParent: false,
          },
        },
      },
    },
  },
  business_hours_schedule_holiday: {
    requests: [
      {
        endpoint: { path: '/api/v2/business_hours/schedules/{parent_id}/holidays' },
        transformation: { root: 'holidays' },
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
  typesToOmit: string[],
): definitions.fetch.FetchApiDefinitions<ZendeskFetchOptions> => ({
  instances: {
    default: {
      resource: { serviceIDFields: ['id'] },
      element: {
        topLevel: { elemID: { parts: DEFAULT_ID_PARTS } },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: _.omit(createCustomizations(), typesToOmit),
  },
})
