/*
*                      Copyright 2023 Salto Labs Ltd.
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
import {
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_ORDER_TYPE_NAME,
  BRAND_TYPE_NAME,
  CATEGORY_ORDER_TYPE_NAME, EVERYONE_USER_TYPE,
  SECTION_ORDER_TYPE_NAME,
  ZENDESK,
} from './constants'

const { createClientConfigType } = clientUtils
const {
  createUserFetchConfigType,
  createUserDeployConfigType,
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
  { fieldName: 'created_by_id' },
  { fieldName: 'updated_by_id' },
]
export const PAGE_SIZE = 100
export const DEFAULT_QUERY_PARAMS = {
  'page[size]': String(PAGE_SIZE),
}
export const CURSOR_BASED_PAGINATION_FIELD = 'links.next'

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const DEPLOY_CONFIG = 'deploy'

export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type IdLocator = {
  fieldRegex: string
  idRegex: string
  type: string[]
}

export type Guide = {
  brands: string[]
}

export type ZendeskClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type ZendeskFetchConfig = configUtils.UserFetchConfig
  & {
  enableMissingReferences?: boolean
  includeAuditDetails?: boolean
  greedyAppReferences?: boolean
  appReferenceLocators?: IdLocator[]
  guide?: Guide
  resolveOrganizationIDs?: boolean
}
export type ZedneskDeployConfig = configUtils.UserDeployConfig
export type ZendeskApiConfig = configUtils.AdapterApiConfig<
  configUtils.DuckTypeTransformationConfig & { omitInactive?: boolean }
  >

export type ZendeskConfig = {
  [CLIENT_CONFIG]?: ZendeskClientConfig
  [FETCH_CONFIG]: ZendeskFetchConfig
  [DEPLOY_CONFIG]?: ZedneskDeployConfig
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
        url: '/api/v2/groups',
        deployAsField: 'group',
        method: 'post',
      },
      modify: {
        url: '/api/v2/groups/{groupId}',
        method: 'put',
        deployAsField: 'group',
        urlParamsToFields: {
          groupId: 'id',
        },
      },
      remove: {
        url: '/api/v2/groups/{groupId}',
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
        url: '/api/v2/custom_roles',
        deployAsField: 'custom_role',
        method: 'post',
      },
      modify: {
        url: '/api/v2/custom_roles/{customRoleId}',
        method: 'put',
        deployAsField: 'custom_role',
        urlParamsToFields: {
          customRoleId: 'id',
        },
      },
      remove: {
        url: '/api/v2/custom_roles/{customRoleId}',
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
        url: '/api/v2/organizations',
        deployAsField: 'organization',
        method: 'post',
      },
      modify: {
        url: '/api/v2/organizations/{organizationId}',
        method: 'put',
        deployAsField: 'organization',
        urlParamsToFields: {
          organizationId: 'id',
        },
      },
      remove: {
        url: '/api/v2/organizations/{organizationId}',
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
        url: '/api/v2/views',
        deployAsField: 'view',
        method: 'post',
      },
      modify: {
        url: '/api/v2/views/{viewId}',
        method: 'put',
        deployAsField: 'view',
        urlParamsToFields: {
          viewId: 'id',
        },
      },
      remove: {
        url: '/api/v2/views/{viewId}',
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
        url: '/api/v2/views/update_many',
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
        url: '/api/v2/triggers',
        deployAsField: 'trigger',
        method: 'post',
      },
      modify: {
        url: '/api/v2/triggers/{triggerId}',
        method: 'put',
        deployAsField: 'trigger',
        urlParamsToFields: {
          triggerId: 'id',
        },
      },
      remove: {
        url: '/api/v2/triggers/{triggerId}',
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
        url: '/api/v2/trigger_categories',
        deployAsField: 'trigger_category',
        method: 'post',
      },
      modify: {
        url: '/api/v2/trigger_categories/{triggerCategoryId}',
        method: 'patch',
        deployAsField: 'trigger_category',
        urlParamsToFields: {
          triggerCategoryId: 'id',
        },
      },
      remove: {
        url: '/api/v2/trigger_categories/{triggerCategoryId}',
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
        url: '/api/v2/trigger_categories/jobs',
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
        url: '/api/v2/automations',
        deployAsField: 'automation',
        method: 'post',
      },
      modify: {
        url: '/api/v2/automations/{automationId}',
        method: 'put',
        deployAsField: 'automation',
        urlParamsToFields: {
          automationId: 'id',
        },
      },
      remove: {
        url: '/api/v2/automations/{automationId}',
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
        url: '/api/v2/automations/update_many',
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
        url: '/api/v2/slas/policies',
        deployAsField: 'sla_policy',
        method: 'post',
      },
      modify: {
        url: '/api/v2/slas/policies/{slaPolicyId}',
        method: 'put',
        deployAsField: 'sla_policy',
        urlParamsToFields: {
          slaPolicyId: 'id',
        },
      },
      remove: {
        url: '/api/v2/slas/policies/{slaPolicyId}',
        method: 'delete',
        deployAsField: 'sla_policy',
        urlParamsToFields: {
          slaPolicyId: 'id',
        },
      },
    },
  },
  sla_policy__filter__all: {
    transformation: {
      // value can be number or string
      fieldTypeOverrides: [{ fieldName: 'value', fieldType: 'unknown' }],
    },
  },
  sla_policy__filter__any: {
    transformation: {
      // value can be number or string
      fieldTypeOverrides: [{ fieldName: 'value', fieldType: 'unknown' }],
    },
  },
  sla_policy_order: {
    deployRequests: {
      modify: {
        url: '/api/v2/slas/policies/reorder',
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
        url: '/api/v2/targets',
        deployAsField: 'target',
        method: 'post',
      },
      modify: {
        url: '/api/v2/targets/{targetId}',
        method: 'put',
        deployAsField: 'target',
        urlParamsToFields: {
          targetId: 'id',
        },
      },
      remove: {
        url: '/api/v2/targets/{targetId}',
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
        url: '/api/v2/macros',
        deployAsField: 'macro',
        method: 'post',
      },
      modify: {
        url: '/api/v2/macros/{macroId}',
        method: 'put',
        deployAsField: 'macro',
        urlParamsToFields: {
          macroId: 'id',
        },
      },
      remove: {
        url: '/api/v2/macros/{macroId}',
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
  [BRAND_TYPE_NAME]: {
    transformation: {
      sourceTypeName: 'brands__brands',
      // We currently not supporting in attachements
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'ticket_form_ids' }),
      fieldTypeOverrides: [
        {
          fieldName: 'help_center_state',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['enabled', 'disabled', 'restricted'] },
        },
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'categories', fieldType: 'list<category>' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      serviceUrl: '/admin/account/brand_management/brands',
    },
    deployRequests: {
      add: {
        url: '/api/v2/brands',
        deployAsField: 'brand',
        method: 'post',
      },
      modify: {
        url: '/api/v2/brands/{brandId}',
        method: 'put',
        deployAsField: 'brand',
        urlParamsToFields: {
          brandId: 'id',
        },
      },
      remove: {
        url: '/api/v2/brands/{brandId}',
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
      url: '/api/v2/business_hours/schedules',
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
        url: '/api/v2/business_hours/schedules',
        deployAsField: 'schedule',
        method: 'post',
      },
      modify: {
        url: '/api/v2/business_hours/schedules/{scheduleId}',
        method: 'put',
        deployAsField: 'schedule',
        urlParamsToFields: {
          scheduleId: 'id',
        },
      },
      remove: {
        url: '/api/v2/business_hours/schedules/{scheduleId}',
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
        {
          fieldName: 'status',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['accepted', 'declined', 'pending', 'inactive'] },
        },
        { fieldName: 'type', fieldType: 'string', restrictions: { enforce_value: true, values: ['inbound', 'outbound'] } },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
    deployRequests: {
      add: {
        url: '/api/v2/sharing_agreements',
        deployAsField: 'sharing_agreement',
        method: 'post',
      },
      modify: {
        url: '/api/v2/sharing_agreements/{sharingAgreementId}',
        method: 'put',
        deployAsField: 'sharing_agreement',
        urlParamsToFields: {
          sharingAgreementId: 'id',
        },
      },
      remove: {
        url: '/api/v2/sharing_agreements/{sharingAgreementId}',
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
      idFields: ['name', '&email'],
      fieldTypeOverrides: [
        {
          fieldName: 'cname_status',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['unknown', 'verified', 'failed'] },
        },
        {
          fieldName: 'dns_results',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['verified', 'failed'] },
        },
        {
          fieldName: 'domain_verification_status',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['unknown', 'verified', 'failed'] },
        },
        {
          fieldName: 'forwarding_status',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['unknown', 'waiting', 'verified', 'failed'] },
        },
        {
          fieldName: 'spf_status',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['unknown', 'verified', 'failed'] },
        },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'domain_verification_code' },
      ]),
    },
    deployRequests: {
      add: {
        url: '/api/v2/recipient_addresses',
        deployAsField: 'recipient_address',
        method: 'post',
      },
      modify: {
        url: '/api/v2/recipient_addresses/{supportAddressId}',
        method: 'put',
        deployAsField: 'recipient_address',
        urlParamsToFields: {
          supportAddressId: 'id',
        },
      },
      remove: {
        url: '/api/v2/recipient_addresses/{supportAddressId}',
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
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'display_name', fieldType: 'string' },
        { fieldName: 'name', fieldType: 'string' }
      ),
      serviceUrl: '/admin/objects-rules/tickets/ticket-forms/edit/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/ticket_forms',
        deployAsField: 'ticket_form',
        method: 'post',
      },
      modify: {
        url: '/api/v2/ticket_forms/{ticketFormId}',
        method: 'put',
        deployAsField: 'ticket_form',
        urlParamsToFields: {
          ticketFormId: 'id',
        },
      },
      remove: {
        url: '/api/v2/ticket_forms/{ticketFormId}',
        method: 'delete',
        deployAsField: 'ticket_form',
        urlParamsToFields: {
          ticketFormId: 'id',
        },
      },
    },
  },
  custom_statuses: {
    request: {
      url: '/api/v2/custom_statuses',
    },
    transformation: {
      dataField: 'custom_statuses',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  custom_status: {
    transformation: {
      sourceTypeName: 'custom_statuses__custom_statuses',
      idFields: ['status_category', 'raw_agent_label'],
      fileNameFields: ['status_category', 'raw_agent_label'],
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'end_user_label', fieldType: 'string' },
        { fieldName: 'agent_label', fieldType: 'string' },
        { fieldName: 'description', fieldType: 'string' },
        { fieldName: 'end_user_description', fieldType: 'string' },
        { fieldName: 'default', fieldType: 'boolean' },
      ),
      fieldsToOmit: FIELDS_TO_OMIT,
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/tickets/ticket_statuses/edit/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/custom_statuses',
        deployAsField: 'custom_status',
        method: 'post',
      },
      modify: {
        url: '/api/v2/custom_statuses/{custom_status_id}',
        method: 'put',
        deployAsField: 'custom_status',
        urlParamsToFields: {
          custom_status_id: 'id',
        },
      },
    },
  },
  ticket_field: {
    transformation: {
      sourceTypeName: 'ticket_fields__ticket_fields',
      idFields: ['raw_title', 'type'],
      fileNameFields: ['raw_title', 'type'],
      standaloneFields: [{ fieldName: 'custom_field_options' }],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'position', fieldType: 'number' },
        { fieldName: 'title', fieldType: 'string' },
        { fieldName: 'description', fieldType: 'string' },
        { fieldName: 'title_in_portal', fieldType: 'string' },
        // TODO may want to add back as part of SALTO-2895
        { fieldName: 'custom_statuses' },
      ),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/tickets/ticket-fields/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/ticket_fields',
        deployAsField: 'ticket_field',
        method: 'post',
      },
      modify: {
        url: '/api/v2/ticket_fields/{ticketFieldId}',
        method: 'put',
        deployAsField: 'ticket_field',
        urlParamsToFields: {
          ticketFieldId: 'id',
        },
      },
      remove: {
        url: '/api/v2/ticket_fields/{ticketFieldId}',
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
        url: '/api/v2/ticket_fields/{ticketFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          ticketFieldId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/ticket_fields/{ticketFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          ticketFieldId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/v2/ticket_fields/{ticketFieldId}/options/{ticketFieldOptionId}',
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
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        {
          fieldName: 'value',
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            // this regex will not allow the following characters to be in the string:
            // & % $ # @ ! { } [ ] = + ( ) * ? < > , " ' ` ; \
            regex: '^[^&%$#@\\! \\{\\}\\[\\]=\\+\\(\\)\\*\\?<>,"\'`;\\\\]+$',
          },
        },
      ],
    },
  },
  user_field: {
    transformation: {
      sourceTypeName: 'user_fields__user_fields',
      idFields: ['key'],
      standaloneFields: [{ fieldName: 'custom_field_options' }],
      fieldTypeOverrides: [
        {
          fieldName: 'type',
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            values: ['checkbox', 'date', 'decimal', 'dropdown', 'integer', 'regexp', 'text', 'textarea'],
          },
        },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'title', fieldType: 'string' },
        { fieldName: 'description', fieldType: 'string' }
      ),
      serviceUrl: '/agent/admin/user_fields/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/user_fields',
        deployAsField: 'user_field',
        method: 'post',
      },
      modify: {
        url: '/api/v2/user_fields/{userFieldId}',
        method: 'put',
        deployAsField: 'user_field',
        urlParamsToFields: {
          userFieldId: 'id',
        },
      },
      remove: {
        url: '/api/v2/user_fields/{userFieldId}',
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
        url: '/api/v2/user_fields/{userFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          userFieldId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/user_fields/{userFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          userFieldId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/v2/user_fields/{userFieldId}/options/{userFieldOptionId}',
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
        url: '/api/v2/user_fields/reorder',
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
        {
          fieldName: 'type',
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            values: ['checkbox', 'date', 'decimal', 'dropdown', 'integer', 'regexp', 'text', 'textarea'],
          },
        },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'title', fieldType: 'string' },
        { fieldName: 'description', fieldType: 'string' }
      ),
      serviceUrl: '/agent/admin/organization_fields/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/organization_fields',
        deployAsField: 'organization_field',
        method: 'post',
      },
      modify: {
        url: '/api/v2/organization_fields/{organizationFieldId}',
        method: 'put',
        deployAsField: 'organization_field',
        urlParamsToFields: {
          organizationFieldId: 'id',
        },
      },
      remove: {
        url: '/api/v2/organization_fields/{organizationFieldId}',
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
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'name', fieldType: 'string' }),
    },
  },
  organization_field_order: {
    transformation: {
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
    deployRequests: {
      modify: {
        url: '/api/v2/organization_fields/reorder',
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
        url: '/api/v2/routing/attributes',
        deployAsField: 'attribute',
        method: 'post',
      },
      modify: {
        url: '/api/v2/routing/attributes/{attributeId}',
        method: 'put',
        deployAsField: 'attribute',
        urlParamsToFields: {
          attributeId: 'id',
        },
      },
      remove: {
        url: '/api/v2/routing/attributes/{attributeId}',
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
        url: '/api/v2/workspaces',
        deployAsField: 'workspace',
        method: 'post',
      },
      modify: {
        url: '/api/v2/workspaces/{workspaceId}',
        method: 'put',
        deployAsField: 'workspace',
        urlParamsToFields: {
          workspaceId: 'id',
        },
      },
      remove: {
        url: '/api/v2/workspaces/{workspaceId}',
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
        url: '/api/v2/workspaces/reorder',
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
        url: '/api/v2/apps/installations',
        method: 'post',
      },
      modify: {
        url: '/api/v2/apps/installations/{appInstallationId}',
        method: 'put',
        urlParamsToFields: {
          appInstallationId: 'id',
        },
      },
      remove: {
        url: '/api/v2/apps/installations/{appInstallationId}',
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
        url: '/api/v2/oauth/clients',
        deployAsField: 'client',
        method: 'post',
      },
      modify: {
        url: '/api/v2/oauth/clients/{oauthClientId}',
        method: 'put',
        deployAsField: 'client',
        urlParamsToFields: {
          oauthClientId: 'id',
        },
      },
      remove: {
        url: '/api/v2/oauth/clients/{oauthClientId}',
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
        url: '/api/v2/account/settings',
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
      url: '/api/v2/groups',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'groups',
    },
  },
  // eslint-disable-next-line camelcase
  custom_roles: {
    request: {
      url: '/api/v2/custom_roles',
    },
    transformation: {
      dataField: 'custom_roles',
    },
  },
  organizations: {
    request: {
      url: '/api/v2/organizations',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'organizations',
    },
  },
  views: {
    request: {
      url: '/api/v2/views',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'views',
      fileNameFields: ['title'],
    },
  },
  triggers: {
    request: {
      url: '/api/v2/triggers',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'triggers',
    },
  },
  trigger_definitions: {
    request: {
      url: '/api/v2/triggers/definitions',
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
      url: '/api/v2/trigger_categories',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'trigger_categories',
    },
  },
  automations: {
    request: {
      url: '/api/v2/automations',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'automations',
    },
  },
  // eslint-disable-next-line camelcase
  sla_policies: {
    request: {
      url: '/api/v2/slas/policies',
    },
  },
  // eslint-disable-next-line camelcase
  sla_policies_definitions: {
    request: {
      url: '/api/v2/slas/policies/definitions',
    },
    transformation: {
      dataField: 'value',
    },
  },
  targets: {
    request: {
      url: '/api/v2/targets',
    },
  },
  macros: {
    request: {
      url: '/api/v2/macros',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'macros',
    },
  },
  // eslint-disable-next-line camelcase
  macros_actions: {
    request: {
      url: '/api/v2/macros/actions',
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
      url: '/api/v2/macros/categories',
    },
    transformation: {
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  // eslint-disable-next-line camelcase
  macros_definitions: { // has some overlaps with macro_actions
    request: {
      url: '/api/v2/macros/definitions',
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
      url: '/api/v2/brands',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'brands',
    },
  },
  // eslint-disable-next-line camelcase
  dynamic_content_item: {
    request: {
      url: '/api/v2/dynamic_content/items',
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
        url: '/api/v2/dynamic_content/items',
        deployAsField: 'item',
        method: 'post',
      },
      modify: {
        url: '/api/v2/dynamic_content/items/{dynamicContentItemId}',
        method: 'put',
        deployAsField: 'item',
        urlParamsToFields: {
          dynamicContentItemId: 'id',
        },
      },
      remove: {
        url: '/api/v2/dynamic_content/items/{dynamicContentItemId}',
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
      extendsParentId: true,
    },
    deployRequests: {
      add: {
        url: '/api/v2/dynamic_content/items/{dynamicContentItemId}/variants',
        deployAsField: 'variant',
        method: 'post',
        urlParamsToFields: {
          dynamicContentItemId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/dynamic_content/items/{dynamicContentItemId}/variants/{dynammicContentVariantId}',
        deployAsField: 'variant',
        method: 'put',
        urlParamsToFields: {
          dynammicContentVariantId: 'id',
          dynamicContentItemId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/v2/dynamic_content/items/{dynamicContentItemId}/variants/{dynammicContentVariantId}',
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
      url: '/api/v2/locales',
    },
    transformation: {
      dataField: 'locales',
    },
  },
  // eslint-disable-next-line camelcase
  business_hours_schedule_holiday: {
    request: {
      url: '/api/v2/business_hours/schedules/{scheduleId}/holidays',
    },
    deployRequests: {
      add: {
        url: '/api/v2/business_hours/schedules/{scheduleId}/holidays',
        deployAsField: 'holiday',
        method: 'post',
        urlParamsToFields: {
          scheduleId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/business_hours/schedules/{scheduleId}/holidays/{holidayId}',
        deployAsField: 'holiday',
        method: 'put',
        urlParamsToFields: {
          holidayId: 'id',
          scheduleId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/v2/business_hours/schedules/{scheduleId}/holidays/{holidayId}',
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
      url: '/api/v2/sharing_agreements',
    },
  },
  // eslint-disable-next-line camelcase
  support_addresses: {
    request: {
      url: '/api/v2/recipient_addresses',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
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
      url: '/api/v2/ticket_forms',
    },
    transformation: {
      dataField: 'ticket_forms',
    },
  },
  ticket_form_order: {
    deployRequests: {
      modify: {
        url: '/api/v2/ticket_forms/reorder',
        method: 'put',
      },
    },
  },
  // eslint-disable-next-line camelcase
  ticket_fields: {
    request: {
      url: '/api/v2/ticket_fields',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
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
      url: '/api/v2/user_fields',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'user_fields',
    },
  },
  // eslint-disable-next-line camelcase
  organization_fields: {
    request: {
      url: '/api/v2/organization_fields',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'organization_fields',
    },
  },
  routing_attribute_value: {
    request: {
      url: '/api/v2/routing/attributes/{attributeId}/values',
    },
    deployRequests: {
      add: {
        url: '/api/v2/routing/attributes/{attributeId}/values',
        deployAsField: 'attribute_value',
        method: 'post',
        urlParamsToFields: {
          attributeId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/routing/attributes/{attributeId}/values/{attributeValueId}',
        deployAsField: 'attribute_value',
        method: 'put',
        urlParamsToFields: {
          attributeValueId: 'id',
          attributeId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/v2/routing/attributes/{attributeId}/values/{attributeValueId}',
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
      url: '/api/v2/routing/attributes',
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
      url: '/api/v2/routing/attributes/definitions',
    },
    transformation: {
      dataField: 'definitions',
    },
  },
  workspaces: {
    // not always available
    request: {
      url: '/api/v2/workspaces',
    },
  },
  // eslint-disable-next-line camelcase
  app_installations: {
    request: {
      url: '/api/v2/apps/installations',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
  },
  // eslint-disable-next-line camelcase
  apps_owned: {
    request: {
      url: '/api/v2/apps/owned',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
  },
  // eslint-disable-next-line camelcase
  oauth_clients: {
    request: {
      url: '/api/v2/oauth/clients',
    },
  },
  // eslint-disable-next-line camelcase
  oauth_global_clients: {
    request: {
      url: '/api/v2/oauth/global_clients',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'global_clients',
    },
  },
  // eslint-disable-next-line camelcase
  account_settings: {
    request: {
      url: '/api/v2/account/settings',
    },
    transformation: {
      dataField: 'settings',
    },
  },
  // eslint-disable-next-line camelcase
  resource_collections: {
    request: {
      url: '/api/v2/resource_collections',
      paginationField: 'next_page',
    },
  },
  // eslint-disable-next-line camelcase
  monitored_twitter_handles: {
    request: {
      url: '/api/v2/channels/twitter/monitored_twitter_handles',
    },
  },
  webhooks: {
    request: {
      url: '/api/v2/webhooks',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
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
        url: '/api/v2/webhooks',
        deployAsField: 'webhook',
        method: 'post',
      },
      modify: {
        url: '/api/v2/webhooks/{webhookId}',
        method: 'patch',
        deployAsField: 'webhook',
        urlParamsToFields: {
          webhookId: 'id',
        },
      },
      remove: {
        url: '/api/v2/webhooks/{webhookId}',
        method: 'delete',
        urlParamsToFields: {
          webhookId: 'id',
        },
      },
    },
  },
  articles: {
    request: {
      // we are doing this for better parallelization of requests on large accounts
      // sort_by is added since articles for which the order is alphabetically fail (to avoid future bugs)
      url: '/api/v2/help_center/categories/{category_id}/articles',
      dependsOn: [
        { pathParam: 'category_id', from: { type: 'categories', field: 'id' } },
      ],
      queryParams: {
        ...DEFAULT_QUERY_PARAMS,
        include: 'translations',
        sort_by: 'updated_at',
      },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
      recurseInto: [
        {
          type: ARTICLE_ATTACHMENT_TYPE_NAME,
          toField: 'attachments',
          context: [{ name: 'article_id', fromField: 'id' }],
        },
      ],
    },
    transformation: {
      dataField: 'articles',
    },
  },
  article: {
    transformation: {
      idFields: ['title', '&section_id'],
      fileNameFields: ['title', '&section_id'],
      standaloneFields: [
        { fieldName: 'translations' },
        { fieldName: 'attachments' },
      ],
      sourceTypeName: 'articles__articles',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'position', fieldType: 'number' },
      ),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'author_id', fieldType: 'string' },
        { fieldName: 'translations', fieldType: 'list<article_translation>' },
        { fieldName: 'attachments', fieldType: 'list<article_attachment>' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'vote_sum' },
        { fieldName: 'vote_count' },
        { fieldName: 'edited_at' },
        { fieldName: 'name' },
        { fieldName: 'html_url', fieldType: 'string' },
      ),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/sections/{sectionId}/articles',
        method: 'post',
        deployAsField: 'article',
        urlParamsToFields: {
          sectionId: 'section_id',
        },
      },
      modify: {
        url: '/api/v2/help_center/articles/{articleId}',
        method: 'put',
        deployAsField: 'article',
        urlParamsToFields: {
          articleId: 'id',
        },
      },
      remove: {
        url: '/api/v2/help_center/articles/{articleId}',
        method: 'delete',
        urlParamsToFields: {
          articleId: 'id',
        },
      },
    },
  },
  [ARTICLE_ATTACHMENT_TYPE_NAME]: {
    request: {
      url: '/api/v2/help_center/articles/{article_id}/attachments',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      idFields: ['file_name', 'inline'],
      sourceTypeName: 'article__attachments',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'content_url', fieldType: 'string' },
        { fieldName: 'size', fieldType: 'number' },
      ),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'article_attachments', fieldType: 'List<article_attachment>' },
        { fieldName: 'content', fieldType: 'string' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'article_id', fieldType: 'number' },
        { fieldName: 'display_file_name', fieldType: 'string' },
        { fieldName: 'relative_path', fieldType: 'string' },
      ),
      extendsParentId: true,
      dataField: 'article_attachments',
    },
    deployRequests: {
      remove: {
        url: '/api/v2/help_center/articles/attachments/{articleAttachmentId}',
        method: 'delete',
        urlParamsToFields: {
          articleAttachmentId: 'id',
        },
      },
    },
  },
  article_translation: {
    transformation: {
      idFields: ['&locale'],
      extendsParentId: true,
      fileNameFields: ['&locale'],
      sourceTypeName: 'article__translations',
      dataField: 'translations',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
      ),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'brand', fieldType: 'number' },
        { fieldName: 'created_by_id', fieldType: 'unknown' },
        { fieldName: 'updated_by_id', fieldType: 'unknown' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'html_url', fieldType: 'string' },
        { fieldName: 'source_id', fieldType: 'number' },
        { fieldName: 'source_type', fieldType: 'string' },
      ),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/articles/{article_id}/translations',
        method: 'post',
        deployAsField: 'translation',
        urlParamsToFields: {
          article_id: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/help_center/articles/{article_id}/translations/{locale}',
        method: 'put',
        deployAsField: 'translation',
        urlParamsToFields: {
          article_id: '_parent.0.id',
          locale: 'locale',
        },
      },
      remove: {
        url: '/api/v2/help_center/translations/{translation_id}',
        method: 'delete',
        urlParamsToFields: {
          translation_id: 'id',
        },
      },
    },
  },
  guide_language_settings: {
    request: {
      url: '/hc/api/internal/help_center_translations',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      idFields: ['&brand', 'locale'],
      fileNameFields: ['&brand', 'locale'],
      dataField: '.',
      // serviceUrl is created in the help_center_service_url filter
    },
    deployRequests: {
      modify: {
        url: '/hc/api/internal/help_center_translations/{locale}',
        method: 'put',
        urlParamsToFields: {
          locale: 'locale',
        },
      },
      add: {
        url: '/hc/api/internal/help_center_translations',
        method: 'post',
        deployAsField: 'locales',
      },
      remove: {
        url: '/hc/api/internal/help_center_translations/{locale}',
        method: 'delete',
        urlParamsToFields: {
          locale: 'locale',
        },
      },
    },
  },
  guide_settings: {
    request: {
      url: '/hc/api/internal/general_settings',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      idFields: ['&brand'],
      fileNameFields: ['&brand'],
      dataField: '.',
      fieldTypeOverrides: [
        { fieldName: 'default_locale', fieldType: 'string' },
      ],
      // serviceUrl is created in the help_center_service_url filter
    },
    deployRequests: {
      modify: {
        url: '/hc/api/internal/general_settings',
        method: 'put',
      },
      // TO DO - check what happens when help center (guide) is created or removed (SALTO-2914)
      // add: {
      //   url: '/hc/api/internal/general_settings',
      //   method: 'post',
      // },
      // remove: {
      //   url: '/hc/api/internal/general_settings',
      //   method: 'delete',
      // },
    },
  },
  guide_settings__help_center: {
    transformation: {
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'feature_restrictions' }, // omited as it does not appear in the http request
      ),
    },
  },
  guide_settings__help_center__settings: {
    transformation: {
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'id' },
        { fieldName: 'account_id', fieldType: 'number' },
        { fieldName: 'help_center_id', fieldType: 'number' },
        { fieldName: 'created_at', fieldType: 'string' },
        { fieldName: 'updated_at', fieldType: 'string' },
        { fieldName: 'draft', fieldType: 'boolean' },
        { fieldName: 'kind', fieldType: 'string' },
      ),
    },
  },
  guide_settings__help_center__text_filter: {
    transformation: {
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'id' },
        { fieldName: 'account_id', fieldType: 'number' },
        { fieldName: 'help_center_id', fieldType: 'number' },
        { fieldName: 'created_at', fieldType: 'string' },
        { fieldName: 'updated_at', fieldType: 'string' },
      ),
    },
  },
  sections: {
    request: {
      url: '/api/v2/help_center/sections',
      queryParams: {
        ...DEFAULT_QUERY_PARAMS,
        include: 'translations',
      },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'sections',
    },
  },
  section: {
    transformation: {
      idFields: [...DEFAULT_ID_FIELDS, '&direct_parent_id'],
      fileNameFields: [...DEFAULT_ID_FIELDS, '&direct_parent_id'],
      standaloneFields: [{ fieldName: 'translations' }],
      sourceTypeName: 'sections__sections',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        // directParent and parentType are created to avoid collisions
        { fieldName: 'direct_parent_id' },
        { fieldName: 'direct_parent_type', fieldType: 'string' },
        { fieldName: 'position', fieldType: 'number' },
      ),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'parent_section_id', fieldType: 'number' },
        { fieldName: 'sections', fieldType: 'list<section>' },
        { fieldName: 'articles', fieldType: 'list<article>' },
        { fieldName: 'translations', fieldType: 'list<section_translation>' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'html_url', fieldType: 'string' },
      ),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/categories/{category_id}/sections',
        method: 'post',
        deployAsField: 'section',
        urlParamsToFields: {
          category_id: 'category_id',
        },
      },
      modify: {
        url: '/api/v2/help_center/sections/{section_id}',
        method: 'put',
        deployAsField: 'section',
        urlParamsToFields: {
          section_id: 'id',
        },
      },
      remove: {
        url: '/api/v2/help_center/sections/{section_id}',
        method: 'delete',
        urlParamsToFields: {
          section_id: 'id',
        },
      },
    },
  },
  section_order: {
    transformation: {
      idFields: [],
      extendsParentId: true,
    },
  },
  article_order: {
    transformation: {
      idFields: [],
      extendsParentId: true,
    },
  },
  category_order: {
    transformation: {
      idFields: [],
      extendsParentId: true,
    },
  },
  section_translation: {
    transformation: {
      idFields: ['&locale'],
      extendsParentId: true,
      fileNameFields: ['&locale'],
      sourceTypeName: 'section__translations',
      dataField: 'translations',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
      ),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'brand', fieldType: 'number' },
        { fieldName: 'created_by_id', fieldType: 'unknown' },
        { fieldName: 'updated_by_id', fieldType: 'unknown' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'html_url', fieldType: 'string' },
        { fieldName: 'source_id', fieldType: 'number' },
        { fieldName: 'source_type', fieldType: 'string' },
      ),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/sections/{section_id}/translations',
        method: 'post',
        deployAsField: 'translation',
        urlParamsToFields: {
          section_id: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/help_center/sections/{section_id}/translations/{locale}',
        method: 'put',
        deployAsField: 'translation',
        urlParamsToFields: {
          section_id: '_parent.0.id',
          locale: 'locale',
        },
      },
      remove: {
        url: '/api/v2/help_center/translations/{translation_id}',
        method: 'delete',
        urlParamsToFields: {
          translation_id: 'id',
        },
      },
    },
  },
  categories: {
    request: {
      url: '/api/v2/help_center/categories',
      queryParams: {
        ...DEFAULT_QUERY_PARAMS,
        include: 'translations',
      },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'categories',
    },
  },
  category: {
    transformation: {
      idFields: [...DEFAULT_ID_FIELDS, '&brand'],
      fileNameFields: [...DEFAULT_ID_FIELDS, '&brand'],
      standaloneFields: [{ fieldName: 'translations' }],
      sourceTypeName: 'categories__categories',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'position', fieldType: 'number' },
      ),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'sections', fieldType: 'list<section>' },
        { fieldName: 'translations', fieldType: 'list<category_translation>' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'html_url', fieldType: 'string' },
      ),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/categories',
        method: 'post',
        deployAsField: 'category',
      },
      modify: {
        url: '/api/v2/help_center/categories/{category_id}',
        method: 'put',
        deployAsField: 'category',
        urlParamsToFields: {
          category_id: 'id',
        },
      },
      remove: {
        url: '/api/v2/help_center/categories/{category_id}',
        method: 'delete',
        urlParamsToFields: {
          category_id: 'id',
        },
      },
    },
  },
  category_translation: {
    transformation: {
      idFields: ['&locale'],
      extendsParentId: true,
      fileNameFields: ['&locale'],
      sourceTypeName: 'category__translations',
      dataField: 'translations',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
      ),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'brand', fieldType: 'number' },
        { fieldName: 'created_by_id', fieldType: 'unknown' },
        { fieldName: 'updated_by_id', fieldType: 'unknown' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'html_url', fieldType: 'string' },
        { fieldName: 'source_id', fieldType: 'number' },
        { fieldName: 'source_type', fieldType: 'string' },
      ),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/categories/{category_id}/translations',
        method: 'post',
        deployAsField: 'translation',
        urlParamsToFields: {
          category_id: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/help_center/categories/{category_id}/translations/{locale}',
        method: 'put',
        deployAsField: 'translation',
        urlParamsToFields: {
          category_id: '_parent.0.id',
          locale: 'locale',
        },
      },
      remove: {
        url: '/api/v2/help_center/translations/{translation_id}',
        method: 'delete',
        urlParamsToFields: {
          translation_id: 'id',
        },
      },
    },
  },
  permission_groups: {
    request: {
      url: '/api/v2/guide/permission_groups',
      queryParams: { per_page: String(PAGE_SIZE) },
      paginationField: 'next_page',
    },
    transformation: {
      dataField: 'permission_groups',
    },
  },
  permission_group: {
    transformation: {
      sourceTypeName: 'permission_groups__permission_groups',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/knowledge/permissions/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/guide/permission_groups',
        deployAsField: 'permission_group',
        method: 'post',
      },
      modify: {
        url: '/api/v2/guide/permission_groups/{permissionGroupId}',
        method: 'put',
        deployAsField: 'permission_group',
        urlParamsToFields: {
          permissionGroupId: 'id',
        },
      },
      remove: {
        url: '/api/v2/guide/permission_groups/{permissionGroupId}',
        method: 'delete',
        urlParamsToFields: {
          permissionGroupId: 'id',
        },
      },
    },
  },
  user_segments: {
    request: {
      url: '/api/v2/help_center/user_segments',
      queryParams: { per_page: String(PAGE_SIZE) },
      paginationField: 'next_page',
    },
    transformation: {
      dataField: 'user_segments',
    },
  },
  user_segment: {
    transformation: {
      sourceTypeName: 'user_segments__user_segments',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        // list items can be user IDs (number) or user email (string)
        { fieldName: 'added_user_ids', fieldType: 'List<unknown>' },
        // list items can be organization IDs (number) or organization names (email)
        { fieldName: 'organization_ids', fieldType: 'List<unknown>' },
        // everyone user type is added as a type we created for user_segment
        {
          fieldName: 'user_type',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['signed_in_users', 'staff', EVERYONE_USER_TYPE] },
        },

      ],
      serviceUrl: '/knowledge/user_segments/edit/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/user_segments',
        deployAsField: 'user_segment',
        method: 'post',
      },
      modify: {
        url: '/api/v2/help_center/user_segments/{userSegmentId}',
        method: 'put',
        deployAsField: 'user_segment',
        urlParamsToFields: {
          userSegmentId: 'id',
        },
      },
      remove: {
        url: '/api/v2/help_center/user_segments/{userSegmentId}',
        method: 'delete',
        urlParamsToFields: {
          userSegmentId: 'id',
        },
      },
    },
  },
  // not included yet: satisfaction_reason (returns 403), sunshine apis

  // SALTO-2177 token-related types that can optionally be supported - but are not included under supportedTypes yet
  api_tokens: {
    request: {
      url: '/api/v2/api_tokens',
    },
    transformation: {
      dataField: 'api_tokens',
    },
  },
  api_token: {
    transformation: {
      sourceTypeName: 'api_tokens__api_tokens',
      idFields: ['description'],
      fieldsToHide: [
        {
          fieldName: 'id',
          fieldType: 'number',
        },
      ],
      serviceUrl: '/admin/apps-integrations/apis/zendesk-api/settings/tokens/',
      fieldTypeOverrides: [
        {
          fieldName: 'id',
          fieldType: 'number',
        },
      ],
    },
  },
  oauth_tokens: {
    request: {
      url: '/api/v2/oauth/tokens',
    },
    transformation: {
      dataField: 'tokens',
    },
  },
  oauth_token: {
    transformation: {
      sourceTypeName: 'oauth_tokens__tokens',
      // note: requires oauth_global_client to be included in the config
      idFields: ['&client_id', 'token'],
      fieldsToHide: [
        {
          fieldName: 'id',
          fieldType: 'number',
        },
      ],
      serviceUrl: '/admin/apps-integrations/apis/zendesk-api/oauth_clients',
      fieldTypeOverrides: [
        {
          fieldName: 'id',
          fieldType: 'number',
        },
      ],
    },
  },
  features: {
    request: {
      url: '/api/v2/account/features',
    },
    transformation: {
      dataField: 'features',
    },
  },
  account_features: {
    transformation: {
      sourceTypeName: 'features__features',
      isSingleton: true,
    },
  },
}

export const SUPPORTED_TYPES = {
  account_setting: ['account_settings'],
  app_installation: ['app_installations'],
  app_owned: ['apps_owned'],
  automation: ['automations'],
  brand: ['brands'],
  business_hours_schedule: ['business_hours_schedules'],
  custom_role: ['custom_roles'],
  custom_status: ['custom_statuses'],
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
  account_features: ['features'],
}

// Types in Zendesk Guide which relate to a certain brand
export const GUIDE_BRAND_SPECIFIC_TYPES = {
  article: ['articles'],
  section: ['sections'],
  category: ['categories'],
  guide_settings: ['guide_settings'],
  guide_language_settings: ['guide_language_settings'],
}

// Types in Zendesk Guide that whose instances are shared across all brands
export const GUIDE_GLOBAL_TYPES = {
  permission_group: ['permission_groups'],
  user_segment: ['user_segments'],
}

export const GUIDE_SUPPORTED_TYPES = {
  ...GUIDE_BRAND_SPECIFIC_TYPES,
  ...GUIDE_GLOBAL_TYPES,
}

export const GUIDE_TYPES_TO_HANDLE_BY_BRAND = [
  ...Object.keys(GUIDE_BRAND_SPECIFIC_TYPES),
  'article_translation',
  'category_translation',
  'section_translation',
  ARTICLE_ATTACHMENT_TYPE_NAME,
  CATEGORY_ORDER_TYPE_NAME,
  SECTION_ORDER_TYPE_NAME,
  ARTICLE_ORDER_TYPE_NAME,
]

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
    resolveOrganizationIDs: false,
    includeAuditDetails: false,
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
  elemID: new ElemID(ZENDESK, 'IdLocatorType'),
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
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const GuideType = createMatchingObjectType<Guide>({
  elemID: new ElemID(ZENDESK, 'GuideType'),
  fields: {
    brands: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        _required: true,
      },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
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
          enableMissingReferences: { refType: BuiltinTypes.BOOLEAN },
          includeAuditDetails: { refType: BuiltinTypes.BOOLEAN },
          greedyAppReferences: { refType: BuiltinTypes.BOOLEAN },
          appReferenceLocators: { refType: IdLocatorType },
          guide: { refType: GuideType },
          resolveOrganizationIDs: { refType: BuiltinTypes.BOOLEAN },
        },
      ),
    },
    [DEPLOY_CONFIG]: {
      refType: createUserDeployConfigType(ZENDESK),
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
      `${FETCH_CONFIG}.guide`,
      `${FETCH_CONFIG}.resolveOrganizationIDs`,
      `${FETCH_CONFIG}.includeAuditDetails`,
      DEPLOY_CONFIG,
    ),
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: ZendeskFetchConfig
  [DEPLOY_CONFIG]?: ZedneskDeployConfig
  [API_DEFINITIONS_CONFIG]: ZendeskApiConfig
}

export const validateFetchConfig = validateDuckTypeFetchConfig

/**
 * Validating each Zendesk Guide type has a dataField property in the configuration
 */
export const validateGuideTypesConfig = (
  adapterApiConfig: configUtils.AdapterApiConfig,
): void => {
  const zendeskGuideTypesWithoutDataField = _.values(GUIDE_SUPPORTED_TYPES).flat()
    .filter(type => adapterApiConfig.types[type].transformation?.dataField === undefined)
  if (zendeskGuideTypesWithoutDataField.length > 0) {
    throw Error(`Invalid Zendesk Guide type(s) ${zendeskGuideTypesWithoutDataField} does not have dataField attribute in the type definition.`)
  }
}

export const isGuideEnabled = (
  fetchConfig: ZendeskFetchConfig
): boolean => (
  fetchConfig.guide?.brands !== undefined
)
