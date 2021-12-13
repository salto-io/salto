/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import { ZENDESK_SUPPORT } from './constants'

const { createClientConfigType } = clientUtils
const {
  createUserFetchConfigType, createDucktypeAdapterApiConfigType, validateDuckTypeFetchConfig,
} = configUtils

export const DEFAULT_ID_FIELDS = ['name', 'id']
export const DEFAULT_FILENAME_FIELDS = ['name']
export const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'created_at', fieldType: 'string' },
  { fieldName: 'updated_at', fieldType: 'string' },
  { fieldName: 'extended_input_schema' },
  { fieldName: 'extended_output_schema' },
  { fieldName: 'url', fieldType: 'string' },
  { fieldName: 'count', fieldType: 'number' },
]

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'

export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type ZendeskClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type ZendeskFetchConfig = configUtils.UserFetchConfig
export type ZendeskApiConfig = configUtils.AdapterDuckTypeApiConfig

export type ZendeskConfig = {
  [CLIENT_CONFIG]?: ZendeskClientConfig
  [FETCH_CONFIG]: ZendeskFetchConfig
  [API_DEFINITIONS_CONFIG]: ZendeskApiConfig
}

export const DEFAULT_TYPES: Record<string, configUtils.TypeDuckTypeConfig> = {
  // types that should exist in workspace
  group: {
    transformation: {
      sourceTypeName: 'groups__groups',
    },
    deployRequests: {
      add: {
        url: '/groups',
        dataField: 'group',
        method: 'post',
      },
      modify: {
        url: '/groups/{groupId}',
        method: 'put',
        dataField: 'group',
        urlVarsToFields: {
          groupId: 'id',
        },
      },
      remove: {
        url: '/groups/{groupId}',
        method: 'delete',
        dataField: 'group',
        urlVarsToFields: {
          groupId: 'id',
        },
      },
    },
  },
  custom_role: {
    transformation: {
      sourceTypeName: 'custom_roles__custom_roles',
    },
  },
  organization: {
    transformation: {
      sourceTypeName: 'organizations__organizations',
    },
  },
  view: {
    transformation: {
      sourceTypeName: 'views__views',
      idFields: ['title', 'id'],
      fileNameFields: ['title'],
    },
  },
  trigger: {
    transformation: {
      sourceTypeName: 'triggers__triggers',
      idFields: ['title', 'id'],
      fileNameFields: ['title'],
    },
  },
  trigger_category: {
    transformation: {
      sourceTypeName: 'trigger_categories__trigger_categories',
      idFields: ['name', 'id'],
      fileNameFields: ['name'],
    },
  },
  automation: {
    transformation: {
      sourceTypeName: 'automations__automations',
      idFields: ['title', 'id'],
      fileNameFields: ['title'],
    },
  },
  sla_policy: {
    transformation: {
      sourceTypeName: 'sla_policies__sla_policies',
      idFields: ['title', 'id'],
      fileNameFields: ['title'],
    },
  },
  sla_policy_definition: {
    transformation: {
      sourceTypeName: 'sla_policies_definitions__definitions',
    },
  },
  target: {
    transformation: {
      sourceTypeName: 'targets__targets',
      idFields: ['title', 'type'], // looks like title is unique so not adding id
    },
  },
  macro: {
    transformation: {
      sourceTypeName: 'macros__macros',
      idFields: ['title', 'id'],
      fileNameFields: ['title'],
    },
  },
  macro_action: {
    transformation: {
      sourceTypeName: 'macros_actions__actions',
    },
  },
  macro_category: {
    transformation: {
      sourceTypeName: 'macros_categories__categories',
    },
  },
  macro_definition: {
    transformation: {
      sourceTypeName: 'macros_definitions__definitions',
    },
  },
  brand: {
    transformation: {
      sourceTypeName: 'brands__brands',
    },
  },
  locale: {
    transformation: {
      sourceTypeName: 'locales__locales',
      idFields: ['locale'],
      fileNameFields: ['locale'],
    },
  },
  business_hours_schedule: {
    transformation: {
      sourceTypeName: 'business_hours_schedules__schedules',
    },
  },
  sharing_agreement: {
    transformation: {
      sourceTypeName: 'sharing_agreements__sharing_agreements',
    },
  },
  recipient_address: {
    transformation: {
      sourceTypeName: 'recipient_addresses__recipient_addresses',
    },
  },
  ticket_form: {
    transformation: {
      sourceTypeName: 'ticket_forms__ticket_forms',
    },
  },
  ticket_field: {
    transformation: {
      sourceTypeName: 'ticket_fields__ticket_fields',
      idFields: ['type', 'title', 'id'],
      fileNameFields: ['type', 'title'],
      standaloneFields: [{ fieldName: 'custom_field_options' }],
    },
  },
  user_field: {
    transformation: {
      sourceTypeName: 'user_fields__user_fields',
      idFields: ['key'],
      standaloneFields: [{ fieldName: 'custom_field_options' }],
    },
  },
  organization_field: {
    transformation: {
      sourceTypeName: 'organization_fields__organization_fields',
      idFields: ['key'],
      standaloneFields: [{ fieldName: 'custom_field_options' }],
    },
  },
  routing_attribute: {
    transformation: {
      sourceTypeName: 'routing_attributes__attributes',
    },
  },
  routing_attribute_definition: {
    transformation: {
      sourceTypeName: 'routing_attribute_definitions__definitions',
      hasDynamicFields: true,
    },
  },
  workspace: {
    transformation: {
      sourceTypeName: 'workspaces__workspaces',
      idFields: ['title', 'id'],
      fileNameFields: ['title'],
    },
  },
  app_installation: {
    transformation: {
      sourceTypeName: 'app_installations__installations',
      fieldsToOmit: [...FIELDS_TO_OMIT, { fieldName: 'updated', fieldType: 'string' }],
      idFields: ['settings.name', 'id'],
      fileNameFields: ['settings.name'],
    },
  },
  app_owned: {
    transformation: {
      sourceTypeName: 'apps_owned__apps',
    },
  },
  oauth_client: {
    transformation: {
      sourceTypeName: 'oauth_clients__clients',
    },
  },
  oauth_global_client: {
    transformation: {
      sourceTypeName: 'oauth_global_clients__global_clients',
    },
  },
  account_setting: {
    transformation: {
      sourceTypeName: 'account_settings__settings',
    },
  },
  resource_collection: {
    transformation: {
      sourceTypeName: 'resource_collections__resource_collections',
    },
  },
  monitored_twitter_handle: {
    transformation: {
      sourceTypeName: 'monitored_twitter_handles__monitored_twitter_handles',
    },
  },


  // api types
  groups: {
    request: {
      url: '/groups',
    },
    transformation: {
      dataField: 'groups',
    },
  },
  // eslint-disable-next-line camelcase
  custom_roles: {
    request: {
      url: '/custom_roles',
    },
    transformation: {
      dataField: 'custom_roles',
    },
  },
  organizations: {
    request: {
      url: '/organizations',
    },
    transformation: {
      dataField: 'organizations',
    },
  },
  views: {
    request: {
      url: '/views',
    },
    transformation: {
      dataField: 'views',
      fileNameFields: ['title'],
    },
  },
  triggers: {
    request: {
      url: '/triggers',
    },
  },
  trigger_categories: {
    request: {
      url: '/trigger_categories',
      paginationField: 'links.next',
    },
    transformation: {
      dataField: 'trigger_categories',
    },
  },
  automations: {
    request: {
      url: '/automations',
    },
    transformation: {
      dataField: 'automations',
    },
  },
  // eslint-disable-next-line camelcase
  sla_policies: {
    request: {
      url: '/slas/policies',
    },
  },
  // eslint-disable-next-line camelcase
  sla_policies_definitions: {
    request: {
      url: '/slas/policies/definitions',
    },
    transformation: {
      dataField: 'value',
    },
  },
  targets: {
    request: {
      url: '/targets',
    },
  },
  macros: {
    request: {
      url: '/macros',
    },
    transformation: {
      dataField: 'macros',
    },
  },
  // eslint-disable-next-line camelcase
  macros_actions: {
    request: {
      url: '/macros/actions',
    },
    transformation: {
      // no unique identifier for individual items
      dataField: '.',
    },
  },
  // eslint-disable-next-line camelcase
  macro_categories: {
    request: {
      url: '/macros/categories',
    },
  },
  // eslint-disable-next-line camelcase
  macros_definitions: { // has some overlaps with macro_actions
    request: {
      url: '/macros/definitions',
    },
  },
  brands: {
    request: {
      url: '/brands',
    },
    transformation: {
      dataField: 'brands',
    },
  },
  // eslint-disable-next-line camelcase
  dynamic_content_item: {
    request: {
      url: '/dynamic_content/items',
    },
    transformation: {
      dataField: '.',
    },
  },
  locales: {
    request: {
      url: '/locales',
    },
    transformation: {
      dataField: 'locales',
    },
  },
  // eslint-disable-next-line camelcase
  business_hours_schedules: {
    request: {
      url: '/business_hours/schedules',
    },
  },
  // eslint-disable-next-line camelcase
  sharing_agreements: {
    request: {
      url: '/sharing_agreements',
    },
  },
  // eslint-disable-next-line camelcase
  recipient_addresses: {
    request: {
      url: '/recipient_addresses',
    },
    transformation: {
      dataField: 'recipient_addresses',
    },
  },
  // eslint-disable-next-line camelcase
  ticket_forms: {
    // not always available
    request: {
      url: '/ticket_forms',
    },
    transformation: {
      dataField: 'ticket_forms',
    },
  },
  // eslint-disable-next-line camelcase
  ticket_fields: {
    request: {
      url: '/ticket_fields',
    },
    transformation: {
      dataField: 'ticket_fields',
      fileNameFields: ['title'],
    },
  },
  // eslint-disable-next-line camelcase
  user_fields: {
    request: {
      url: '/user_fields',
    },
  },
  // eslint-disable-next-line camelcase
  organization_fields: {
    request: {
      url: '/organization_fields',
    },
  },
  // eslint-disable-next-line camelcase
  routing_attributes: {
    request: {
      url: '/routing/attributes',
    },
  },
  // eslint-disable-next-line camelcase
  routing_attribute_definitions: {
    request: {
      url: '/routing/attributes/definitions',
    },
    transformation: {
      dataField: 'definitions',
    },
  },
  workspaces: {
    // not always available
    request: {
      url: '/workspaces',
    },
  },
  // eslint-disable-next-line camelcase
  app_installations: {
    request: {
      url: '/apps/installations',
    },
  },
  // eslint-disable-next-line camelcase
  apps_owned: {
    request: {
      url: '/apps/owned',
    },
  },
  // eslint-disable-next-line camelcase
  oauth_clients: {
    request: {
      url: '/oauth/clients',
    },
  },
  // eslint-disable-next-line camelcase
  oauth_global_clients: {
    request: {
      url: '/oauth/global_clients',
    },
  },
  // eslint-disable-next-line camelcase
  account_settings: {
    request: {
      url: '/account/settings',
    },
    transformation: {
      dataField: 'settings',
    },
  },
  // eslint-disable-next-line camelcase
  resource_collections: {
    request: {
      url: '/resource_collections',
    },
  },
  // eslint-disable-next-line camelcase
  monitored_twitter_handles: {
    request: {
      url: '/channels/twitter/monitored_twitter_handles',
    },
  },
  // not included yet: satisfaction_reason (returns 403), sunshine apis
}

export const configType = createMatchingObjectType<ZendeskConfig>({
  elemID: new ElemID(ZENDESK_SUPPORT),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType(ZENDESK_SUPPORT),
    },
    [FETCH_CONFIG]: {
      refType: createUserFetchConfigType(ZENDESK_SUPPORT),
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.DEFAULT]: {
          includeTypes: [
            ...Object.keys(_.pickBy(DEFAULT_TYPES, def => def.request !== undefined)),
          ].sort(),
        },
      },
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createDucktypeAdapterApiConfigType({ adapter: ZENDESK_SUPPORT }),
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.DEFAULT]: {
          typeDefaults: {
            request: {
              paginationField: 'next_page',
            },
            transformation: {
              idFields: DEFAULT_ID_FIELDS,
              fileNameFields: DEFAULT_FILENAME_FIELDS,
              fieldsToOmit: FIELDS_TO_OMIT,
            },
          },
          types: DEFAULT_TYPES,
        },
      },
    },
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: ZendeskFetchConfig
  [API_DEFINITIONS_CONFIG]: ZendeskApiConfig
}

export const validateFetchConfig = validateDuckTypeFetchConfig
