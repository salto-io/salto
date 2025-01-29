/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'
import { Options } from '../types'
import {
  BOT_BUILDER_ANSWER,
  CONVERSATION_BOT,
  BOT_BUILDER_NODE,
  BUSINESS_HOUR_SCHEDULE_HOLIDAY,
  EVERYONE_USER_TYPE,
} from '../../constants'
import {
  transformBotItem,
  transformGuideItem,
  transformQueueItem,
  transformSectionItem,
  transformTriggerItem,
} from './transforms'
import { flowsQuery } from './graphql_schemas'

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

// Note: hiding fields inside arrays is not supported, and can result in a corrupted workspace.
// when in doubt, it's best to hide fields only for relevant types, or to omit them.
const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {
  // hide
  created_at: { hide: true },
  updated_at: { hide: true },
  created_by_id: { hide: true },
  updated_by_id: { hide: true },

  // omit
  count: { omit: true },
  url: { omit: true },
  extended_output_schema: { omit: true },
  extended_input_schema: { omit: true },
}

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
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
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
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
        alias: { aliasComponents: [{ fieldName: 'title' }] },
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
        transformation: { root: 'triggers', adjust: transformTriggerItem },
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
        alias: { aliasComponents: [{ fieldName: 'title' }] },
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
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
        alias: { aliasComponents: [{ fieldName: 'title' }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'title' }, { fieldName: 'type' }] }] },
        alias: { aliasComponents: [{ fieldName: 'title' }] },
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
        alias: { aliasComponents: [{ fieldName: 'title' }] },
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
        alias: { aliasComponents: [{ fieldName: 'title' }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'fileName' }] }] },
        alias: { aliasComponents: [{ fieldName: 'filename' }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
        alias: { aliasComponents: [{ fieldName: 'agent_label' }] },
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
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/tickets/ticket-fields/{id}' },
        elemID: { parts: [{ fieldName: 'raw_title' }, { fieldName: 'type' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'raw_title' }, { fieldName: 'type' }] }] },
        alias: { aliasComponents: [{ fieldName: 'title' }] },
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
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'value' }], extendsParent: true },
        path: { pathParts: [{ parts: [{ fieldName: 'value' }], extendsParent: true }] },
        alias: { aliasComponents: [{ fieldName: 'value' }] },
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
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/agent/admin/user_fields/{id}' },
        elemID: { parts: [{ fieldName: 'key', mapping: 'lowercase' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'key', mapping: 'lowercase' }] }] },
        alias: { aliasComponents: [{ fieldName: 'title' }] },
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
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'value' }], extendsParent: true },
        path: { pathParts: [{ parts: [{ fieldName: 'value' }], extendsParent: true }] },
        alias: { aliasComponents: [{ fieldName: 'value' }] },
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
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/agent/admin/organization_fields/{id}' },
        elemID: { parts: [{ fieldName: 'key' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'key' }] }] },
        alias: { aliasComponents: [{ fieldName: 'title' }] },
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
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'value' }], extendsParent: true },
        path: { pathParts: [{ parts: [{ fieldName: 'value' }], extendsParent: true }] },
        alias: { aliasComponents: [{ fieldName: 'value' }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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

  brand_logo: {
    element: {
      topLevel: {
        isTopLevel: true,
        alias: { aliasComponents: [{ fieldName: 'filename' }] },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        filename: { fieldType: 'string' },
        contentType: { fieldType: 'string' },
        content: { fieldType: 'string' },
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
        alias: { aliasComponents: [{ fieldName: 'presentation_name' }] },
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
        alias: { aliasComponents: [{ fieldName: 'settings.name' }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
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
        elemID: { parts: [{ fieldName: 'name' }, { fieldName: 'email', isReference: true }], useOldFormat: true },
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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

  queue: {
    requests: [
      {
        endpoint: { path: '/api/v2/queues' },
        transformation: { root: 'queues', adjust: transformQueueItem },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/omnichannel-routing/queues/edit/{id}' },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'string' },
        order: { hide: true, fieldType: 'number' },
      },
    },
  },
  // placeholder for order nacls
  queue_order: {},

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
        alias: { aliasComponents: [{ fieldName: 'id' }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'string' },
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
        elemID: { parts: [{ fieldName: 'name', mapping: 'lowercase' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'name', mapping: 'lowercase' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
        elemID: { parts: [{ fieldName: 'locale_id', isReference: true }], extendsParent: true, useOldFormat: true },
        path: { pathParts: [{ parts: [{ fieldName: 'locale_id', isReference: true }], extendsParent: true }] },
        alias: {
          aliasComponents: [
            {
              fieldName: '_parent.0',
              referenceFieldName: '_alias',
            },
            {
              fieldName: 'locale_id',
              referenceFieldName: 'locale',
              useFieldValueAsFallback: true,
            },
          ],
          separator: ' - ',
        },
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
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'client_id', isReference: true }, { fieldName: 'token' }] }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'description' }] }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'key' }] }] },
        alias: { aliasComponents: [{ fieldName: 'key' }] },
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
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true, parts: [{ fieldName: 'key' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'key' }], extendsParent: true }] },
        alias: { aliasComponents: [{ fieldName: 'key' }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'value' }], extendsParent: true }] },
        alias: { aliasComponents: [{ fieldName: 'value' }] },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        // these fields are generated by their raw_ counterparts, and we create them on preDeploy
        name: { omit: true },
      },
    },
  },

  account_features: {
    requests: [{ endpoint: { path: '/api/v2/account/features' }, transformation: { root: 'features' } }],
    resource: { directFetch: true },
    element: {
      topLevel: { isTopLevel: true, singleton: true },
    },
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
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: DEFAULT_ID_PARTS, extendsParent: true },
        serviceUrl: { path: '/admin/objects-rules/rules/routing' },
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
        alias: { aliasComponents: [{ fieldName: 'title' }] },
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

  layout: {
    requests: [
      {
        endpoint: { path: '/api/v2/layouts' },
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
        serviceUrl: { path: 'admin/workspaces/agent-workspace/layouts' },
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'string' },
        created_by_user_id: { hide: true },
        updated_by_user_id: { hide: true },
      },
    },
  },

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
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
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
          typeName: BUSINESS_HOUR_SCHEDULE_HOLIDAY,
          context: { args: { parent_id: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/admin/objects-rules/rules/schedules' },
        path: { pathParts: [{ parts: [{ fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        holidays: {
          // extract each item in the holidays field to its own instance
          standalone: {
            typeName: BUSINESS_HOUR_SCHEDULE_HOLIDAY,
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  [BUSINESS_HOUR_SCHEDULE_HOLIDAY]: {
    requests: [
      {
        endpoint: { path: '/api/v2/business_hours/schedules/{parent_id}/holidays' },
        transformation: { root: 'holidays' },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: DEFAULT_ID_PARTS, extendsParent: true, useOldFormat: true },
        path: { pathParts: [{ parts: DEFAULT_ID_PARTS }] },
        alias: { aliasComponents: DEFAULT_ID_PARTS },
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        start_year: { fieldType: 'string', hide: true },
        end_year: { fieldType: 'string', hide: true },
      },
    },
  },

  category: {
    requests: [
      {
        endpoint: {
          path: '/api/v2/help_center/categories',
          queryArgs: { include: 'translations' },
          client: 'guide',
          params: {
            brand: { id: '{brandId}' },
          },
        },
        transformation: { root: 'categories', adjust: transformGuideItem },
      },
    ],
    resource: {
      directFetch: true,
      context: {
        dependsOn: {
          brandId: {
            parentTypeName: 'brand',
            transformation: {
              root: 'id',
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'name' }, { fieldName: 'brand', isReference: true }], useOldFormat: true },
        path: { pathParts: [{ parts: [{ fieldName: 'name' }, { fieldName: 'brand', isReference: true }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
        // serviceUrl is created in help_center_service_url filter
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        position: { hide: true },
        sections: { fieldType: 'list<section>' },
        html_url: { omit: true },
        translations: {
          standalone: {
            typeName: 'category_translation',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },

  category_translation: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'locale', isReference: true }], extendsParent: true, useOldFormat: true },
        path: { pathParts: [{ parts: [{ fieldName: 'locale', isReference: true }] }] },
        alias: {
          aliasComponents: [
            {
              fieldName: 'locale',
              referenceFieldName: 'locale',
              useFieldValueAsFallback: true,
            },
            {
              fieldName: '_parent.0',
              referenceFieldName: '_alias',
            },
          ],
          separator: ' - ',
        },
        // serviceUrl is created in help_center_service_url filter
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        brand: { fieldType: 'number' },
        created_by_id: { fieldType: 'unknown' },
        updated_by_id: { fieldType: 'unknown' },
        html_url: { omit: true },
        source_id: { omit: true },
        source_type: { omit: true },
      },
    },
  },

  category_order: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { useOldFormat: true, extendsParent: true },
        alias: {
          aliasComponents: [
            {
              fieldName: '_parent.0',
              referenceFieldName: '_alias',
            },
            {
              constant: 'Category Order',
            },
          ],
        },
      },
    },
  },

  channel: {
    element: {
      topLevel: {
        isTopLevel: true,
        alias: { aliasComponents: [{ fieldName: 'name' }] },
      },
      fieldCustomizations: {
        id: { hide: true }, // id is a string
        name: { fieldType: 'string' },
      },
    },
  },

  section_translation: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'locale', isReference: true }], extendsParent: true, useOldFormat: true },
        path: { pathParts: [{ parts: [{ fieldName: 'locale', isReference: true }], extendsParent: true }] },
        alias: {
          aliasComponents: [
            {
              fieldName: 'locale',
              referenceFieldName: 'locale',
              useFieldValueAsFallback: true,
            },
            {
              fieldName: '_parent.0',
              referenceFieldName: '_alias',
            },
          ],
          separator: ' - ',
        },
        // serviceUrl is created in help_center_service_url filter
      },
      fieldCustomizations: {
        id: { fieldType: 'number', hide: true },
        brand: { fieldType: 'number' },
        created_by_id: { fieldType: 'unknown' },
        updated_by_id: { fieldType: 'unknown' },
        html_url: { omit: true },
        source_id: { omit: true },
        source_type: { omit: true },
      },
    },
  },

  section_order: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { useOldFormat: true, extendsParent: true },
        alias: {
          aliasComponents: [
            {
              fieldName: '_parent.0',
              referenceFieldName: '_alias',
            },
            {
              constant: 'Section Order',
            },
          ],
        },
      },
    },
  },

  section: {
    requests: [
      {
        endpoint: {
          path: '/api/v2/help_center/sections',
          queryArgs: { include: 'translations' },
          client: 'guide',
          params: {
            brand: { id: '{brandId}' },
          },
        },
        transformation: { root: 'sections', adjust: transformSectionItem },
      },
    ],
    resource: {
      directFetch: true,
      context: {
        dependsOn: {
          brandId: {
            parentTypeName: 'brand',
            transformation: {
              root: 'id',
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'name' }, { fieldName: 'direct_parent_id', isReference: true }],
          useOldFormat: true,
        },
        path: { pathParts: [{ parts: [{ fieldName: 'name' }, { fieldName: 'direct_parent_id', isReference: true }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
        // serviceUrl is created in help_center_service_url filter
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        // directParent and parentType are created to avoid collisions
        direct_parent_id: { hide: true },
        direct_parent_type: { hide: true, fieldType: 'string' },
        position: { hide: true },
        parent_section_id: { fieldType: 'number' },
        sections: { fieldType: 'list<section>' },
        articles: { fieldType: 'list<article>' },
        html_url: { omit: true },
        translations: {
          // extract each item in the holidays field to its own instance
          standalone: {
            typeName: 'section_translation',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },

  article: {
    requests: [
      {
        // we are doing this for better parallelization of requests on large accounts
        // sort_by is added since articles for which the order is alphabetically fail (to avoid future bugs)
        endpoint: {
          path: '/api/v2/help_center/categories/{parent.id}/articles',
          queryArgs: { include: 'translations', sort_by: 'updated_at' },
          client: 'guide',
          params: {
            brand: { id: '{parent.brand}' },
          },
        },
        transformation: { root: 'articles', adjust: transformGuideItem },
        context: {
          lookFor: 'category.brand',
        },
      },
    ],
    resource: {
      directFetch: true,
      context: {
        dependsOn: {
          parent: { parentTypeName: 'category', transformation: { pick: ['id', 'brand'] } },
        },
      },
      recurseInto: {
        attachments: {
          typeName: 'article_attachment',
          context: { args: { parent: { pick: ['id', 'brand'] } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'title' }, { fieldName: 'section_id', isReference: true }],
          useOldFormat: true,
        },
        path: { pathParts: [{ parts: [{ fieldName: 'title' }, { fieldName: 'section_id', isReference: true }] }] },
        alias: { aliasComponents: [{ fieldName: 'title' }] },
        // serviceUrl is created in help_center_service_url filter
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        position: { hide: true },
        author_id: { fieldType: 'unknown' },
        draft: { omit: true },
        vote_sum: { omit: true },
        vote_count: { omit: true },
        edited_at: { omit: true },
        name: { omit: true },
        html_url: { omit: true },
        attachments: {
          standalone: {
            typeName: 'article_attachment',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
        translations: {
          standalone: {
            typeName: 'article_translation',
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },

  // currently articles do not share attachments, if this changes the attachment code should be reviewed!
  article_attachment: {
    requests: [
      {
        // we are doing this for better parallelization of requests on large accounts
        // sort_by is added since articles for which the order is alphabetically fail (to avoid future bugs)
        endpoint: {
          path: '/api/v2/help_center/articles/{parent.id}/attachments',
          client: 'guide',
          params: {
            brand: { id: '{parent.brand}' },
          },
        },
        transformation: { root: 'article_attachments', adjust: transformGuideItem },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'file_name' }, { fieldName: 'inline' }],
          extendsParent: true,
          useOldFormat: true,
        },
        path: { pathParts: [{ parts: [{ fieldName: 'file_name' }, { fieldName: 'inline' }], extendsParent: true }] },
        alias: {
          aliasComponents: [
            {
              fieldName: 'file_name',
            },
            {
              fieldName: '_parent.0',
              referenceFieldName: '_alias',
            },
          ],
          separator: ' - ',
        },
        // serviceUrl is created in help_center_service_url filter
      },
      ignoreDefaultFieldCustomizations: true,
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        content_url: { hide: true, fieldType: 'string' },
        size: { hide: true, fieldType: 'number' },
        relative_path: { hide: true, fieldType: 'string' },
        content: { fieldType: 'string' },
        hash: { hide: true, fieldType: 'string' },
        display_file_name: { omit: true },
        article_id: { omit: true },
        created_at: { hide: true },
        updated_at: { hide: true },
        url: { omit: true },
        article_attachments: { fieldType: 'List<article_attachment>' },
      },
    },
  },

  article_translation: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'locale', isReference: true }], extendsParent: true, useOldFormat: true },
        path: { pathParts: [{ parts: [{ fieldName: 'locale', isReference: true }], extendsParent: true }] },
        alias: {
          aliasComponents: [
            {
              fieldName: 'locale',
              referenceFieldName: 'locale',
              useFieldValueAsFallback: true,
            },
            {
              fieldName: '_parent.0',
              referenceFieldName: '_alias',
            },
          ],
          separator: ' - ',
        },
        // serviceUrl is created in help_center_service_url filter
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'number' },
        brand: { fieldType: 'number' },
        created_by_id: { fieldType: 'unknown' },
        updated_by_id: { fieldType: 'unknown' },
        html_url: { omit: true },
        source_id: { omit: true },
        source_type: { omit: true },
      },
    },
  },

  article_order: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { useOldFormat: true, extendsParent: true },
        alias: {
          aliasComponents: [
            {
              fieldName: '_parent.0',
              referenceFieldName: '_alias',
            },
            {
              constant: 'Article Order',
            },
          ],
        },
      },
    },
  },

  theme: {
    requests: [
      {
        endpoint: {
          path: '/api/v2/guide/theming/themes',
        },
        transformation: { root: 'themes', adjust: transformGuideItem },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'brand_id', isReference: true }, { fieldName: 'name' }],
          useOldFormat: true,
        },
        path: { pathParts: [{ parts: [{ fieldName: 'brand_id', isReference: true }, { fieldName: 'name' }] }] },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
        // serviceUrl is created in help_center_service_url filter
      },
      fieldCustomizations: {
        id: { hide: true, fieldType: 'string' },
        live: { hide: true, fieldType: 'boolean' },
        author: { hide: true, fieldType: 'string' },
        version: { hide: true, fieldType: 'string' },
        root: { fieldType: 'theme_folder' },
      },
    },
  },

  theme_file: {
    element: {
      fieldCustomizations: {
        filename: { fieldType: 'string' },
        content: { fieldType: 'unknown' },
      },
    },
  },

  theme_folder: {
    element: {
      fieldCustomizations: {
        files: { fieldType: 'map<theme_file>' },
        folders: { fieldType: 'map<theme_folder>' },
      },
    },
  },

  theme_settings: {
    element: {
      fieldCustomizations: {
        brand: { fieldType: 'number' },
        liveTheme: { fieldType: 'string' },
      },
      topLevel: {
        isTopLevel: true,
        alias: {
          aliasComponents: [
            {
              fieldName: 'brand',
              referenceFieldName: '_alias',
            },
            {
              constant: 'Theme settings',
            },
          ],
        },
      },
    },
  },

  guide_language_settings: {
    requests: [
      {
        endpoint: {
          path: '/hc/api/internal/help_center_translations',
          client: 'guide',
          params: {
            brand: { id: '{brandId}' },
          },
        },
        transformation: { root: '.', adjust: transformGuideItem },
      },
    ],
    resource: {
      serviceIDFields: [],
      directFetch: true,
      context: {
        dependsOn: {
          brandId: {
            parentTypeName: 'brand',
            transformation: {
              root: 'id',
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'brand', isReference: true }, { fieldName: 'locale' }], useOldFormat: true },
        path: {
          pathParts: [{ parts: [{ fieldName: 'brand', isReference: true }, { fieldName: 'locale' }] }],
        },
        alias: {
          aliasComponents: [
            {
              fieldName: 'brand',
              referenceFieldName: '_alias',
            },
            {
              fieldName: 'locale',
            },
            {
              constant: 'language settings',
            },
          ],
        },
        // serviceUrl is created in help_center_service_url filter
      },
    },
  },

  guide_settings: {
    requests: [
      {
        endpoint: {
          path: '/hc/api/internal/general_settings',
          client: 'guide',
          params: {
            brand: { id: '{brandId}' },
          },
        },
        transformation: { root: '.', adjust: transformGuideItem },
      },
    ],
    resource: {
      serviceIDFields: [],
      directFetch: true,
      context: {
        dependsOn: {
          brandId: {
            parentTypeName: 'brand',
            transformation: {
              root: 'id',
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'brand', isReference: true }], useOldFormat: true },
        path: { pathParts: [{ parts: [{ fieldName: 'brand', isReference: true }] }] },
        alias: {
          aliasComponents: [
            {
              fieldName: 'brand',
              referenceFieldName: '_alias',
            },
            {
              constant: 'Settings',
            },
          ],
        },
        // serviceUrl is created in help_center_service_url filter
      },
      fieldCustomizations: {
        default_locale: { fieldType: 'string' },
      },
    },
  },

  guide_settings__help_center: {
    element: {
      fieldCustomizations: {
        feature_restrictions: { omit: true }, // omitted as it does not appear in the http request
      },
    },
  },

  guide_settings__help_center__settings: {
    element: {
      fieldCustomizations: {
        id: { omit: true },
        account_id: { omit: true },
        help_center_id: { omit: true },
        created_at: { omit: true },
        updated_at: { omit: true },
        draft: { omit: true },
        kind: { omit: true },
      },
    },
  },

  guide_settings__help_center__text_filter: {
    element: {
      fieldCustomizations: {
        id: { omit: true },
        account_id: { omit: true },
        help_center_id: { omit: true },
        created_at: { omit: true },
        updated_at: { omit: true },
      },
    },
  },

  [CONVERSATION_BOT]: {
    requests: [
      {
        endpoint: {
          path: '/api/admin/private/answer_bot/graphql',
          method: 'post',
          data: {
            operationName: 'fetchFlows',
            query: flowsQuery,
          },
        },
        transformation: { root: '.', adjust: transformBotItem },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'brandId', isReference: true }, { fieldName: 'name' }] },
        path: { pathParts: [{ parts: [{ fieldName: 'brandId', isReference: true }, { fieldName: 'name' }] }] },
        alias: {
          aliasComponents: [
            {
              fieldName: 'brandId',
              referenceFieldName: '_alias',
            },
            { fieldName: 'name' },
          ],
        },
        serviceUrl: { path: '/admin/channels/ai-agents-automation/ai-agents/conversation-bots/{id}/insights' },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        id: { hide: true },
        brandId: { fieldType: 'string' },
        subflows: {
          sort: {
            properties: [{ path: 'name' }],
          },
          standalone: {
            typeName: BOT_BUILDER_ANSWER,
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  [BOT_BUILDER_ANSWER]: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: DEFAULT_ID_PARTS, extendsParent: true },
        path: {
          pathParts: [{ parts: DEFAULT_ID_PARTS, extendsParent: true }],
        },
        alias: {
          aliasComponents: DEFAULT_ID_PARTS,
        },
        serviceUrl: {
          path: '/admin/channels/ai-agents-automation/ai-agents/conversation-bots/{_parent.0.id}/answers/{id}/canvas',
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        id: { hide: true },
        nodes: {
          sort: {
            properties: [{ path: 'id' }],
          },
          standalone: {
            typeName: BOT_BUILDER_NODE,
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  [BOT_BUILDER_NODE]: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'externalId' }], extendsParent: true },
        path: { pathParts: [{ parts: [{ fieldName: 'externalId' }], extendsParent: true }] },
        alias: {
          aliasComponents: [
            {
              fieldName: '_parent.0',
              referenceFieldName: '_alias',
            },
            { fieldName: 'targetType' },
          ],
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        id: { fieldType: 'string', hide: true },
        externalId: { fieldType: 'string', hide: true },
      },
    },
  },
})

export const createFetchDefinitions = ({
  typesToOmit,
  typesToPick,
  baseUrl,
}: {
  typesToOmit?: string[]
  typesToPick?: string[]
  baseUrl?: string
}): definitions.fetch.FetchApiDefinitions<Options> => {
  const initialCustomizations = createCustomizations()
  const withoutOmitted = typesToOmit !== undefined ? _.omit(initialCustomizations, typesToOmit) : initialCustomizations
  const finalCustomizations = typesToPick !== undefined ? _.pick(withoutOmitted, typesToPick) : withoutOmitted

  return {
    instances: {
      default: {
        resource: {
          serviceIDFields: ['id'],
          onError: fetchUtils.errors.createGetInsufficientPermissionsErrorFunction([403]),
        },
        element: {
          topLevel: { elemID: { parts: DEFAULT_ID_PARTS }, serviceUrl: { baseUrl } },
          fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
        },
      },
      customizations: finalCustomizations,
    },
  }
}
