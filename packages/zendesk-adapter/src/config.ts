/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, CORE_ANNOTATIONS, BuiltinTypes, ListType } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { client as clientUtils, config as configUtils, elements } from '@salto-io/adapter-components'
import { BRAND_NAME, ZENDESK } from './constants'

const { createClientConfigType } = clientUtils
const {
  createUserFetchConfigType,
  createDucktypeAdapterApiConfigType,
  validateDuckTypeFetchConfig,
} = configUtils

export const DEFAULT_ID_FIELDS = ['name']
export const DEFAULT_FILENAME_FIELDS = ['name']
export const DEFAULT_SERVICE_ID_FIELD = 'id'
export const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'extended_input_schema' },
  { fieldName: 'extended_output_schema' },
  { fieldName: 'url', fieldType: 'string' },
  { fieldName: 'count', fieldType: 'number' },
]
export const FIELDS_TO_HIDE: configUtils.FieldToHideType[] = [
  { fieldName: 'created_at', fieldType: 'string' },
  { fieldName: 'updated_at', fieldType: 'string' },
]

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'

export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type IdLocator = {
  fieldRegex: string
  idRegex: string
  type: string[]
}

export type ZendeskClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type ZendeskFetchConfig = configUtils.DuckTypeUserFetchConfig
  & {
    enableMissingReferences?: boolean
    greedyAppReferences?: boolean
    appReferenceLocators?: IdLocator[]
  }
export type ZendeskApiConfig = configUtils.AdapterApiConfig<
  configUtils.DuckTypeTransformationConfig & { omitInactive?: boolean }
>

export type ZendeskConfig = {
  [CLIENT_CONFIG]?: ZendeskClientConfig
  [FETCH_CONFIG]: ZendeskFetchConfig
  [API_DEFINITIONS_CONFIG]: ZendeskApiConfig
}

export const DEFAULT_TYPES: ZendeskApiConfig['types'] = {
  // types that should exist in workspace
  group: {
    transformation: {
      sourceTypeName: 'groups__groups',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      serviceUrl: '/admin/people/team/groups',
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
    deployRequests: {
      add: {
        url: '/groups',
        deployAsField: 'group',
        method: 'post',
      },
      modify: {
        url: '/groups/{groupId}',
        method: 'put',
        deployAsField: 'group',
        urlParamsToFields: {
          groupId: 'id',
        },
      },
      remove: {
        url: '/groups/{groupId}',
        method: 'delete',
        deployAsField: 'group',
        urlParamsToFields: {
          groupId: 'id',
        },
      },
    },
  },
  custom_role: {
    transformation: {
      sourceTypeName: 'custom_roles__custom_roles',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldsToOmit: FIELDS_TO_OMIT.concat([
        // always 0 - https://developer.zendesk.com/api-reference/ticketing/account-configuration/custom_roles/#json-format
        { fieldName: 'role_type', fieldType: 'number' },
        { fieldName: 'team_member_count', fieldType: 'number' },
      ]),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/people/team/roles/{id}',
    },
    deployRequests: {
      add: {
        url: '/custom_roles',
        deployAsField: 'custom_role',
        method: 'post',
      },
      modify: {
        url: '/custom_roles/{customRoleId}',
        method: 'put',
        deployAsField: 'custom_role',
        urlParamsToFields: {
          customRoleId: 'id',
        },
      },
      remove: {
        url: '/custom_roles/{customRoleId}',
        method: 'delete',
        deployAsField: 'custom_role',
        urlParamsToFields: {
          customRoleId: 'id',
        },
      },
    },
  },
  organization: {
    transformation: {
      sourceTypeName: 'organizations__organizations',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [
        { fieldName: 'organization_fields', fieldType: 'map<unknown>' },
        { fieldName: 'id', fieldType: 'number' },
      ],
      serviceUrl: '/agent/organizations/{id}/tickets',
    },
    deployRequests: {
      add: {
        url: '/organizations',
        deployAsField: 'organization',
        method: 'post',
      },
      modify: {
        url: '/organizations/{organizationId}',
        method: 'put',
        deployAsField: 'organization',
        urlParamsToFields: {
          organizationId: 'id',
        },
      },
      remove: {
        url: '/organizations/{organizationId}',
        method: 'delete',
        deployAsField: 'organization',
        urlParamsToFields: {
          organizationId: 'id',
        },
      },
    },
  },
  view: {
    transformation: {
      sourceTypeName: 'views__views',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/workspaces/agent-workspace/views/{id}',
    },
    deployRequests: {
      add: {
        url: '/views',
        deployAsField: 'view',
        method: 'post',
      },
      modify: {
        url: '/views/{viewId}',
        method: 'put',
        deployAsField: 'view',
        urlParamsToFields: {
          viewId: 'id',
        },
      },
      remove: {
        url: '/views/{viewId}',
        method: 'delete',
        deployAsField: 'view',
        urlParamsToFields: {
          viewId: 'id',
        },
      },
    },
  },
  view_order: {
    deployRequests: {
      modify: {
        url: '/views/update_many',
        method: 'put',
      },
    },
  },
  view__restriction: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'unknown' },
      ],
    },
  },
  trigger: {
    transformation: {
      sourceTypeName: 'triggers__triggers',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/rules/triggers/{id}',
    },
    deployRequests: {
      add: {
        url: '/triggers',
        deployAsField: 'trigger',
        method: 'post',
      },
      modify: {
        url: '/triggers/{triggerId}',
        method: 'put',
        deployAsField: 'trigger',
        urlParamsToFields: {
          triggerId: 'id',
        },
      },
      remove: {
        url: '/triggers/{triggerId}',
        method: 'delete',
        deployAsField: 'trigger',
        urlParamsToFields: {
          triggerId: 'id',
        },
      },
    },
  },
  trigger_category: {
    transformation: {
      sourceTypeName: 'trigger_categories__trigger_categories',
      fileNameFields: ['name'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id' }),
      serviceUrl: '/admin/objects-rules/rules/triggers',
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
    deployRequests: {
      add: {
        url: '/trigger_categories',
        deployAsField: 'trigger_category',
        method: 'post',
      },
      modify: {
        url: '/trigger_categories/{triggerCategoryId}',
        method: 'patch',
        deployAsField: 'trigger_category',
        urlParamsToFields: {
          triggerCategoryId: 'id',
        },
      },
      remove: {
        url: '/trigger_categories/{triggerCategoryId}',
        method: 'delete',
        deployAsField: 'trigger_category',
        urlParamsToFields: {
          triggerCategoryId: 'id',
        },
      },
    },
  },
  trigger_order: {
    deployRequests: {
      modify: {
        url: '/trigger_categories/jobs',
        method: 'post',
        deployAsField: 'job',
      },
    },
  },
  trigger_order_entry: {
    transformation: {
      sourceTypeName: 'trigger_order__order',
    },
  },
  automation: {
    transformation: {
      sourceTypeName: 'automations__automations',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/rules/automations/{id}',
    },
    deployRequests: {
      add: {
        url: '/automations',
        deployAsField: 'automation',
        method: 'post',
      },
      modify: {
        url: '/automations/{automationId}',
        method: 'put',
        deployAsField: 'automation',
        urlParamsToFields: {
          automationId: 'id',
        },
      },
      remove: {
        url: '/automations/{automationId}',
        method: 'delete',
        deployAsField: 'automation',
        urlParamsToFields: {
          automationId: 'id',
        },
      },
    },
  },
  automation_order: {
    deployRequests: {
      modify: {
        url: '/automations/update_many',
        method: 'put',
      },
    },
  },
  sla_policy: {
    transformation: {
      sourceTypeName: 'sla_policies__sla_policies',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/rules/slas',
    },
    deployRequests: {
      add: {
        url: '/slas/policies',
        deployAsField: 'sla_policy',
        method: 'post',
      },
      modify: {
        url: '/slas/policies/{slaPolicyId}',
        method: 'put',
        deployAsField: 'sla_policy',
        urlParamsToFields: {
          slaPolicyId: 'id',
        },
      },
      remove: {
        url: '/slas/policies/{slaPolicyId}',
        method: 'delete',
        deployAsField: 'sla_policy',
        urlParamsToFields: {
          slaPolicyId: 'id',
        },
      },
    },
  },
  sla_policy_order: {
    deployRequests: {
      modify: {
        url: '/slas/policies/reorder',
        method: 'put',
      },
    },
  },
  sla_policy_definition: {
    transformation: {
      sourceTypeName: 'sla_policies_definitions__definitions',
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  target: {
    transformation: {
      sourceTypeName: 'targets__targets',
      idFields: ['title', 'type'], // looks like title is unique so not adding id
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/apps-integrations/targets/targets',
    },
    deployRequests: {
      add: {
        url: '/targets',
        deployAsField: 'target',
        method: 'post',
      },
      modify: {
        url: '/targets/{targetId}',
        method: 'put',
        deployAsField: 'target',
        urlParamsToFields: {
          targetId: 'id',
        },
      },
      remove: {
        url: '/targets/{targetId}',
        method: 'delete',
        deployAsField: 'target',
        urlParamsToFields: {
          targetId: 'id',
        },
      },
    },
  },
  macro: {
    transformation: {
      sourceTypeName: 'macros__macros',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'position', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/workspaces/agent-workspace/macros/{id}',
    },
    deployRequests: {
      add: {
        url: '/macros',
        deployAsField: 'macro',
        method: 'post',
      },
      modify: {
        url: '/macros/{macroId}',
        method: 'put',
        deployAsField: 'macro',
        urlParamsToFields: {
          macroId: 'id',
        },
      },
      remove: {
        url: '/macros/{macroId}',
        method: 'delete',
        deployAsField: 'macro',
        urlParamsToFields: {
          macroId: 'id',
        },
      },
    },
  },
  macro_attachment: {
    transformation: {
      idFields: ['filename'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  macro_action: {
    transformation: {
      sourceTypeName: 'macros_actions__actions',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  macro_category: {
    transformation: {
      sourceTypeName: 'macros_categories__categories',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  macro_definition: {
    transformation: {
      sourceTypeName: 'macros_definitions__definitions',
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  [BRAND_NAME]: {
    transformation: {
      sourceTypeName: 'brands__brands',
      // We currently not supporting in attachements
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'ticket_form_ids' }),
      fieldTypeOverrides: [
        { fieldName: 'help_center_state', fieldType: 'string', restrictions: { enforce_value: true, values: ['enabled', 'disabled', 'restricted'] } },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      serviceUrl: '/admin/account/brand_management/brands',
    },
    deployRequests: {
      add: {
        url: '/brands',
        deployAsField: 'brand',
        method: 'post',
      },
      modify: {
        url: '/brands/{brandId}',
        method: 'put',
        deployAsField: 'brand',
        urlParamsToFields: {
          brandId: 'id',
        },
      },
      remove: {
        url: '/brands/{brandId}',
        method: 'delete',
        deployAsField: 'brand',
        urlParamsToFields: {
          brandId: 'id',
        },
      },
    },
  },
  locale: {
    transformation: {
      sourceTypeName: 'locales__locales',
      idFields: ['locale'],
      fileNameFields: ['locale'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  business_hours_schedules: {
    request: {
      url: '/business_hours/schedules',
      recurseInto: [
        {
          type: 'business_hours_schedule_holiday',
          toField: 'holidays',
          context: [{ name: 'scheduleId', fromField: 'id' }],
        },
      ],
    },
    transformation: {
      dataField: 'schedules',
    },
  },
  business_hours_schedule: {
    transformation: {
      standaloneFields: [{ fieldName: 'holidays' }],
      sourceTypeName: 'business_hours_schedules__schedules',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/rules/schedules',
    },
    deployRequests: {
      add: {
        url: '/business_hours/schedules',
        deployAsField: 'schedule',
        method: 'post',
      },
      modify: {
        url: '/business_hours/schedules/{scheduleId}',
        method: 'put',
        deployAsField: 'schedule',
        urlParamsToFields: {
          scheduleId: 'id',
        },
      },
      remove: {
        url: '/business_hours/schedules/{scheduleId}',
        method: 'delete',
        deployAsField: 'schedule',
        urlParamsToFields: {
          scheduleId: 'id',
        },
      },
    },
  },
  sharing_agreement: {
    transformation: {
      sourceTypeName: 'sharing_agreements__sharing_agreements',
      fieldTypeOverrides: [
        { fieldName: 'status', fieldType: 'string', restrictions: { enforce_value: true, values: ['accepted', 'declined', 'pending', 'inactive'] } },
        { fieldName: 'type', fieldType: 'string', restrictions: { enforce_value: true, values: ['inbound', 'outbound'] } },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
    deployRequests: {
      add: {
        url: '/sharing_agreements',
        deployAsField: 'sharing_agreement',
        method: 'post',
      },
      modify: {
        url: '/sharing_agreements/{sharingAgreementId}',
        method: 'put',
        deployAsField: 'sharing_agreement',
        urlParamsToFields: {
          sharingAgreementId: 'id',
        },
      },
      remove: {
        url: '/sharing_agreements/{sharingAgreementId}',
        method: 'delete',
        deployAsField: 'sharing_agreement',
        urlParamsToFields: {
          sharingAgreementId: 'id',
        },
      },
    },
  },
  support_address: {
    transformation: {
      sourceTypeName: 'support_addresses__recipient_addresses',
      fieldTypeOverrides: [
        { fieldName: 'cname_status', fieldType: 'string', restrictions: { enforce_value: true, values: ['unknown', 'verified', 'failed'] } },
        { fieldName: 'dns_results', fieldType: 'string', restrictions: { enforce_value: true, values: ['verified', 'failed'] } },
        { fieldName: 'domain_verification_status', fieldType: 'string', restrictions: { enforce_value: true, values: ['unknown', 'verified', 'failed'] } },
        { fieldName: 'forwarding_status', fieldType: 'string', restrictions: { enforce_value: true, values: ['unknown', 'waiting', 'verified', 'failed'] } },
        { fieldName: 'spf_status', fieldType: 'string', restrictions: { enforce_value: true, values: ['unknown', 'verified', 'failed'] } },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'domain_verification_code' },
      ]),
    },
    deployRequests: {
      add: {
        url: '/recipient_addresses',
        deployAsField: 'recipient_address',
        method: 'post',
      },
      modify: {
        url: '/recipient_addresses/{supportAddressId}',
        method: 'put',
        deployAsField: 'recipient_address',
        urlParamsToFields: {
          supportAddressId: 'id',
        },
      },
      remove: {
        url: '/recipient_addresses/{supportAddressId}',
        method: 'delete',
        deployAsField: 'recipient_address',
        urlParamsToFields: {
          supportAddressId: 'id',
        },
      },
    },
  },
  ticket_form: {
    transformation: {
      sourceTypeName: 'ticket_forms__ticket_forms',
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'number' },
      ]),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/tickets/ticket-forms/edit/{id}',
    },
    deployRequests: {
      add: {
        url: '/ticket_forms',
        deployAsField: 'ticket_form',
        method: 'post',
      },
      modify: {
        url: '/ticket_forms/{ticketFormId}',
        method: 'put',
        deployAsField: 'ticket_form',
        urlParamsToFields: {
          ticketFormId: 'id',
        },
      },
      remove: {
        url: '/ticket_forms/{ticketFormId}',
        method: 'delete',
        deployAsField: 'ticket_form',
        urlParamsToFields: {
          ticketFormId: 'id',
        },
      },
    },
  },
  ticket_field: {
    transformation: {
      sourceTypeName: 'ticket_fields__ticket_fields',
      idFields: ['title', 'type'],
      fileNameFields: ['title', 'type'],
      standaloneFields: [{ fieldName: 'custom_field_options' }],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'position', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/tickets/ticket-fields/{id}',
    },
    deployRequests: {
      add: {
        url: '/ticket_fields',
        deployAsField: 'ticket_field',
        method: 'post',
      },
      modify: {
        url: '/ticket_fields/{ticketFieldId}',
        method: 'put',
        deployAsField: 'ticket_field',
        urlParamsToFields: {
          ticketFieldId: 'id',
        },
      },
      remove: {
        url: '/ticket_fields/{ticketFieldId}',
        method: 'delete',
        deployAsField: 'ticket_field',
        urlParamsToFields: {
          ticketFieldId: 'id',
        },
      },
    },
  },
  ticket_field__custom_field_options: {
    deployRequests: {
      add: {
        url: '/ticket_fields/{ticketFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          ticketFieldId: '_parent.0.id',
        },
      },
      modify: {
        url: '/ticket_fields/{ticketFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          ticketFieldId: '_parent.0.id',
        },
      },
      remove: {
        url: '/ticket_fields/{ticketFieldId}/options/{ticketFieldOptionId}',
        method: 'delete',
        urlParamsToFields: {
          ticketFieldId: '_parent.0.id',
          ticketFieldOptionId: 'id',
        },
      },
    },
    transformation: {
      idFields: ['value'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  user_field: {
    transformation: {
      sourceTypeName: 'user_fields__user_fields',
      idFields: ['key'],
      standaloneFields: [{ fieldName: 'custom_field_options' }],
      fieldTypeOverrides: [
        { fieldName: 'type', fieldType: 'string', restrictions: { enforce_value: true, values: ['checkbox', 'date', 'decimal', 'dropdown', 'integer', 'regexp', 'text', 'textarea'] } },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      serviceUrl: '/agent/admin/user_fields/{id}',
    },
    deployRequests: {
      add: {
        url: '/user_fields',
        deployAsField: 'user_field',
        method: 'post',
      },
      modify: {
        url: '/user_fields/{userFieldId}',
        method: 'put',
        deployAsField: 'user_field',
        urlParamsToFields: {
          userFieldId: 'id',
        },
      },
      remove: {
        url: '/user_fields/{userFieldId}',
        method: 'delete',
        deployAsField: 'user_field',
        urlParamsToFields: {
          userFieldId: 'id',
        },
      },
    },
  },
  user_field__custom_field_options: {
    deployRequests: {
      add: {
        url: '/user_fields/{userFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          userFieldId: '_parent.0.id',
        },
      },
      modify: {
        url: '/user_fields/{userFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          userFieldId: '_parent.0.id',
        },
      },
      remove: {
        url: '/user_fields/{userFieldId}/options/{userFieldOptionId}',
        method: 'delete',
        urlParamsToFields: {
          userFieldId: '_parent.0.id',
          userFieldOptionId: 'id',
        },
      },
    },
    transformation: {
      idFields: ['value'],
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'default', fieldType: 'boolean' },
      ),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  user_field_order: {
    deployRequests: {
      modify: {
        url: '/user_fields/reorder',
        method: 'put',
      },
    },
  },
  organization_field: {
    transformation: {
      sourceTypeName: 'organization_fields__organization_fields',
      idFields: ['key'],
      standaloneFields: [{ fieldName: 'custom_field_options' }],
      fieldTypeOverrides: [
        { fieldName: 'type', fieldType: 'string', restrictions: { enforce_value: true, values: ['checkbox', 'date', 'decimal', 'dropdown', 'integer', 'regexp', 'text', 'textarea'] } },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      serviceUrl: '/agent/admin/organization_fields/{id}',
    },
    deployRequests: {
      add: {
        url: '/organization_fields',
        deployAsField: 'organization_field',
        method: 'post',
      },
      modify: {
        url: '/organization_fields/{organizationFieldId}',
        method: 'put',
        deployAsField: 'organization_field',
        urlParamsToFields: {
          organizationFieldId: 'id',
        },
      },
      remove: {
        url: '/organization_fields/{organizationFieldId}',
        method: 'delete',
        deployAsField: 'organization_field',
        urlParamsToFields: {
          organizationFieldId: 'id',
        },
      },
    },
  },
  organization_field__custom_field_options: {
    transformation: {
      idFields: ['value'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  organization_field_order: {
    transformation: {
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
    deployRequests: {
      modify: {
        url: '/organization_fields/reorder',
        method: 'put',
      },
    },
  },
  routing_attribute: {
    transformation: {
      standaloneFields: [{ fieldName: 'values' }],
      sourceTypeName: 'routing_attributes__attributes',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'string' }),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'string' },
      ],
      serviceUrl: '/admin/objects-rules/rules/routing',
    },
    deployRequests: {
      add: {
        url: '/routing/attributes',
        deployAsField: 'attribute',
        method: 'post',
      },
      modify: {
        url: '/routing/attributes/{attributeId}',
        method: 'put',
        deployAsField: 'attribute',
        urlParamsToFields: {
          attributeId: 'id',
        },
      },
      remove: {
        url: '/routing/attributes/{attributeId}',
        method: 'delete',
        deployAsField: 'attribute',
        urlParamsToFields: {
          attributeId: 'id',
        },
      },
    },
  },
  routing_attribute_definition: {
    transformation: {
      sourceTypeName: 'routing_attribute_definitions__definitions',
      hasDynamicFields: true,
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  workspace: {
    transformation: {
      sourceTypeName: 'workspaces__workspaces',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/workspaces/agent-workspace/contextual-workspaces',
    },
    deployRequests: {
      add: {
        url: '/workspaces',
        deployAsField: 'workspace',
        method: 'post',
      },
      modify: {
        url: '/workspaces/{workspaceId}',
        method: 'put',
        deployAsField: 'workspace',
        urlParamsToFields: {
          workspaceId: 'id',
        },
      },
      remove: {
        url: '/workspaces/{workspaceId}',
        method: 'delete',
        deployAsField: 'workspace',
        urlParamsToFields: {
          workspaceId: 'id',
        },
      },
    },
  },
  workspace__selected_macros: {
    transformation: {
      fieldsToHide: [],
    },
  },
  workspace__selected_macros__restriction: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'unknown' },
      ],
    },
  },
  workspace__apps: {
    transformation: {
      fieldsToHide: [],
    },
  },
  workspace_order: {
    deployRequests: {
      modify: {
        url: '/workspaces/reorder',
        method: 'put',
      },
    },
  },
  app_installation: {
    transformation: {
      sourceTypeName: 'app_installations__installations',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
      ),
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'updated', fieldType: 'string' }),
      idFields: ['settings.name', 'app_id'],
      fileNameFields: ['settings.name', 'app_id'],
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/apps-integrations/apps/support-apps',
    },
    deployRequests: {
      add: {
        url: '/apps/installations',
        method: 'post',
      },
      modify: {
        url: '/apps/installations/{appInstallationId}',
        method: 'put',
        urlParamsToFields: {
          appInstallationId: 'id',
        },
      },
      remove: {
        url: '/apps/installations/{appInstallationId}',
        method: 'delete',
        urlParamsToFields: {
          appInstallationId: 'id',
        },
      },
    },
  },
  app_owned: {
    transformation: {
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'parameters', fieldType: 'map<app_owned__parameters>' },
      ],
      sourceTypeName: 'apps_owned__apps',
    },
  },
  app_owned__parameters: {
    transformation: {
      fieldsToHide: FIELDS_TO_HIDE.concat([{ fieldName: 'id' }, { fieldName: 'app_id' }]),
      fieldsToOmit: [],
    },
  },
  oauth_client: {
    transformation: {
      sourceTypeName: 'oauth_clients__clients',
      idFields: ['identifier'],
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'secret', fieldType: 'string' },
        { fieldName: 'user_id', fieldType: 'number' },
      ]),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/apps-integrations/apis/zendesk-api/oauth_clients',
    },
    deployRequests: {
      add: {
        url: '/oauth/clients',
        deployAsField: 'client',
        method: 'post',
      },
      modify: {
        url: '/oauth/clients/{oauthClientId}',
        method: 'put',
        deployAsField: 'client',
        urlParamsToFields: {
          oauthClientId: 'id',
        },
      },
      remove: {
        url: '/oauth/clients/{oauthClientId}',
        method: 'delete',
        deployAsField: 'client',
        urlParamsToFields: {
          oauthClientId: 'id',
        },
      },
    },
  },
  oauth_global_client: {
    transformation: {
      sourceTypeName: 'oauth_global_clients__global_clients',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  account_setting: {
    transformation: {
      sourceTypeName: 'account_settings__settings',
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
    deployRequests: {
      modify: {
        url: '/account/settings',
        method: 'put',
        deployAsField: 'settings',
      },
    },
  },
  resource_collection: {
    transformation: {
      sourceTypeName: 'resource_collections__resource_collections',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  monitored_twitter_handle: {
    transformation: {
      sourceTypeName: 'monitored_twitter_handles__monitored_twitter_handles',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
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
  trigger_definitions: {
    request: {
      url: '/triggers/definitions',
    },
    transformation: {
      dataField: 'definitions',
    },
  },
  trigger_definition: {
    transformation: {
      sourceTypeName: 'trigger_definitions__definitions',
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
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
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  // eslint-disable-next-line camelcase
  macro_categories: {
    request: {
      url: '/macros/categories',
    },
    transformation: {
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  // eslint-disable-next-line camelcase
  macros_definitions: { // has some overlaps with macro_actions
    request: {
      url: '/macros/definitions',
    },
    transformation: {
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  macro__restriction: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'unknown' },
      ],
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
      standaloneFields: [{ fieldName: 'variants' }],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/workspaces/agent-workspace/dynamic_content',
    },
    deployRequests: {
      add: {
        url: '/dynamic_content/items',
        deployAsField: 'item',
        method: 'post',
      },
      modify: {
        url: '/dynamic_content/items/{dynamicContentItemId}',
        method: 'put',
        deployAsField: 'item',
        urlParamsToFields: {
          dynamicContentItemId: 'id',
        },
      },
      remove: {
        url: '/dynamic_content/items/{dynamicContentItemId}',
        method: 'delete',
        deployAsField: 'item',
        urlParamsToFields: {
          dynamicContentItemId: 'id',
        },
      },
    },
  },
  dynamic_content_item__variants: {
    transformation: {
      idFields: ['&locale_id'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
    deployRequests: {
      add: {
        url: '/dynamic_content/items/{dynamicContentItemId}/variants',
        deployAsField: 'variant',
        method: 'post',
        urlParamsToFields: {
          dynamicContentItemId: '_parent.0.id',
        },
      },
      modify: {
        url: '/dynamic_content/items/{dynamicContentItemId}/variants/{dynammicContentVariantId}',
        deployAsField: 'variant',
        method: 'put',
        urlParamsToFields: {
          dynammicContentVariantId: 'id',
          dynamicContentItemId: '_parent.0.id',
        },
      },
      remove: {
        url: '/dynamic_content/items/{dynamicContentItemId}/variants/{dynammicContentVariantId}',
        method: 'delete',
        urlParamsToFields: {
          dynammicContentVariantId: 'id',
          dynamicContentItemId: '_parent.0.id',
        },
      },
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
  business_hours_schedule_holiday: {
    request: {
      url: '/business_hours/schedules/{scheduleId}/holidays',
    },
    deployRequests: {
      add: {
        url: '/business_hours/schedules/{scheduleId}/holidays',
        deployAsField: 'holiday',
        method: 'post',
        urlParamsToFields: {
          scheduleId: '_parent.0.id',
        },
      },
      modify: {
        url: '/business_hours/schedules/{scheduleId}/holidays/{holidayId}',
        deployAsField: 'holiday',
        method: 'put',
        urlParamsToFields: {
          holidayId: 'id',
          scheduleId: '_parent.0.id',
        },
      },
      remove: {
        url: '/business_hours/schedules/{scheduleId}/holidays/{holidayId}',
        method: 'delete',
        urlParamsToFields: {
          holidayId: 'id',
          scheduleId: '_parent.0.id',
        },
      },
    },
    transformation: {
      sourceTypeName: 'business_hours_schedule__holidays',
      dataField: 'holidays',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  // eslint-disable-next-line camelcase
  sharing_agreements: {
    request: {
      url: '/sharing_agreements',
    },
  },
  // eslint-disable-next-line camelcase
  support_addresses: {
    request: {
      url: '/recipient_addresses',
    },
    transformation: {
      sourceTypeName: 'recipient_addresses',
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
  ticket_form_order: {
    deployRequests: {
      modify: {
        url: '/ticket_forms/reorder',
        method: 'put',
      },
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
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
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
  routing_attribute_value: {
    request: {
      url: '/routing/attributes/{attributeId}/values',
    },
    deployRequests: {
      add: {
        url: '/routing/attributes/{attributeId}/values',
        deployAsField: 'attribute_value',
        method: 'post',
        urlParamsToFields: {
          attributeId: '_parent.0.id',
        },
      },
      modify: {
        url: '/routing/attributes/{attributeId}/values/{attributeValueId}',
        deployAsField: 'attribute_value',
        method: 'put',
        urlParamsToFields: {
          attributeValueId: 'id',
          attributeId: '_parent.0.id',
        },
      },
      remove: {
        url: '/routing/attributes/{attributeId}/values/{attributeValueId}',
        method: 'delete',
        urlParamsToFields: {
          attributeValueId: 'id',
          attributeId: '_parent.0.id',
        },
      },
    },
    transformation: {
      sourceTypeName: 'routing_attribute__values',
      dataField: 'attribute_values',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'string' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'string' }],
      serviceUrl: '/admin/objects-rules/rules/routing',
    },
  },
  // eslint-disable-next-line camelcase
  routing_attributes: {
    request: {
      url: '/routing/attributes',
      recurseInto: [
        {
          type: 'routing_attribute_value',
          toField: 'values',
          context: [{ name: 'attributeId', fromField: 'id' }],
        },
      ],
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
  webhooks: {
    request: {
      url: '/webhooks',
      paginationField: 'links.next',
    },
    transformation: {
      dataField: 'webhooks',
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'meta' }),
    },
  },
  webhook: {
    transformation: {
      sourceTypeName: 'webhooks__webhooks',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'string' },
        { fieldName: 'created_by', fieldType: 'string' },
        { fieldName: 'updated_by', fieldType: 'string' },
      ),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'string' }],
      serviceUrl: '/admin/apps-integrations/webhooks/webhooks/{id}/details',
    },
    deployRequests: {
      add: {
        url: '/webhooks',
        deployAsField: 'webhook',
        method: 'post',
      },
      modify: {
        url: '/webhooks/{webhookId}',
        method: 'patch',
        deployAsField: 'webhook',
        urlParamsToFields: {
          webhookId: 'id',
        },
      },
      remove: {
        url: '/webhooks/{webhookId}',
        method: 'delete',
        urlParamsToFields: {
          webhookId: 'id',
        },
      },
    },
  },
  // not included yet: satisfaction_reason (returns 403), sunshine apis
}

export const SUPPORTED_TYPES = {
  account_setting: ['account_settings'],
  app_installation: ['app_installations'],
  app_owned: ['apps_owned'],
  automation: ['automations'],
  brand: ['brands'],
  business_hours_schedule: ['business_hours_schedules'],
  custom_role: ['custom_roles'],
  dynamic_content_item: ['dynamic_content_item'],
  group: ['groups'],
  locale: ['locales'],
  macro_categories: ['macro_categories'],
  macro: ['macros'],
  monitored_twitter_handle: ['monitored_twitter_handles'],
  oauth_client: ['oauth_clients'],
  oauth_global_client: ['oauth_global_clients'],
  organization: ['organizations'],
  organization_field: ['organization_fields'],
  resource_collection: ['resource_collections'],
  routing_attribute: ['routing_attributes'],
  sharing_agreement: ['sharing_agreements'],
  sla_policy: ['sla_policies'],
  support_address: ['support_addresses'],
  target: ['targets'],
  ticket_field: ['ticket_fields'],
  ticket_form: ['ticket_forms'],
  trigger_category: ['trigger_categories'],
  trigger_definition: ['trigger_definitions'],
  trigger: ['triggers'],
  user_field: ['user_fields'],
  view: ['views'],
  webhook: ['webhooks'],
  workspace: ['workspaces'],
}

export const DEFAULT_CONFIG: ZendeskConfig = {
  [FETCH_CONFIG]: {
    include: [{
      type: elements.query.ALL_TYPES,
    }],
    exclude: [
      { type: 'organization' },
      { type: 'oauth_global_client' },
    ],
    hideTypes: true,
    enableMissingReferences: true,
  },
  [API_DEFINITIONS_CONFIG]: {
    typeDefaults: {
      request: {
        paginationField: 'next_page',
      },
      transformation: {
        idFields: DEFAULT_ID_FIELDS,
        fileNameFields: DEFAULT_FILENAME_FIELDS,
        fieldsToOmit: FIELDS_TO_OMIT,
        fieldsToHide: FIELDS_TO_HIDE,
        serviceIdField: DEFAULT_SERVICE_ID_FIELD,
      },
    },
    types: DEFAULT_TYPES,
    supportedTypes: SUPPORTED_TYPES,
  },
}

const IdLocatorType = createMatchingObjectType<IdLocator>({
  elemID: new ElemID(ZENDESK, 'recurseIntoContext'),
  fields: {
    fieldRegex: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    idRegex: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    type: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        _required: true,
      },
    },
  },
})

export const configType = createMatchingObjectType<Partial<ZendeskConfig>>({
  elemID: new ElemID(ZENDESK),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType(ZENDESK),
    },
    [FETCH_CONFIG]: {
      refType: createUserFetchConfigType(
        ZENDESK,
        {
          hideTypes: { refType: BuiltinTypes.BOOLEAN },
          enableMissingReferences: { refType: BuiltinTypes.BOOLEAN },
          greedyAppReferences: { refType: BuiltinTypes.BOOLEAN },
          appReferenceLocators: { refType: IdLocatorType },
        },
      ),
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createDucktypeAdapterApiConfigType({ adapter: ZENDESK }),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(
      DEFAULT_CONFIG,
      API_DEFINITIONS_CONFIG,
      `${FETCH_CONFIG}.hideTypes`,
      `${FETCH_CONFIG}.enableMissingReferences`,
    ),
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: ZendeskFetchConfig
  [API_DEFINITIONS_CONFIG]: ZendeskApiConfig
}

export const validateFetchConfig = validateDuckTypeFetchConfig
