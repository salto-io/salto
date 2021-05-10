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
import { ElemID, CORE_ANNOTATIONS, ListType, BuiltinTypes } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import { ZUORA_BILLING, CUSTOM_OBJECT_DEFINITION_TYPE, LIST_ALL_SETTINGS_TYPE, SETTINGS_TYPE_PREFIX } from './constants'

const { createClientConfigType } = clientUtils
const { createUserFetchConfigType, createSwaggerAdapterApiConfigType } = configUtils

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type ZuoraClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type ZuoraFetchConfig = configUtils.UserFetchConfig & {
  settingsIncludeTypes?: string[]
}
export type ZuoraApiConfig = configUtils.AdapterSwaggerApiConfig

export type ZuoraConfig = {
  [CLIENT_CONFIG]?: ZuoraClientConfig
  [FETCH_CONFIG]: ZuoraFetchConfig
  [API_DEFINITIONS_CONFIG]: ZuoraApiConfig
}

const DEFAULT_ID_FIELDS = ['name']
export const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'createdBy', fieldType: 'string' },
  { fieldName: 'createdOn', fieldType: 'string' },
  { fieldName: 'updatedBy', fieldType: 'string' },
  { fieldName: 'updatedOn', fieldType: 'string' },
  { fieldName: 'updatedById', fieldType: 'string' },
  { fieldName: 'CreatedDate', fieldType: 'string' },
  { fieldName: 'UpdatedDate', fieldType: 'string' },
  { fieldName: 'CreatedById', fieldType: 'string' },
  { fieldName: 'UpdatedById', fieldType: 'string' },
  { fieldName: 'nextPage', fieldType: 'string' },
  { fieldName: 'next', fieldType: 'string' },
  { fieldName: 'pagination' },
]

const DEFAULT_TYPE_CUSTOMIZATIONS: ZuoraApiConfig['types'] = {
  WorkflowExport: {
    request: {
      // for now relying on the specific param name from the swagger (workflow_id),
      // if it changes this should be updated accordingly
      url: '/workflows/{workflow_id}/export',
      dependsOn: [
        { pathParam: 'workflow_id', from: { type: 'Workflows', field: 'id' } },
      ],
    },
    transformation: {
      // not multienv-friendly, but name and config alone are not unique
      // (it is possible to clone two identical workflows using the UI)
      idFields: ['workflow.name', 'workflow.id'],
      standaloneFields: [
        { fieldName: 'workflow' },
        { fieldName: 'tasks' },
      ],
    },
  },
  Workflows: {
    request: {
      url: '/workflows',
      paginationField: 'pagination.next_page',
    },
  },
  EventTriggers: {
    request: {
      url: '/events/event-triggers',
      paginationField: 'next',
    },
  },
  NotificationDefinitions: {
    request: {
      url: '/notifications/notification-definitions',
      paginationField: 'next',
    },
  },
  NotificationEmailTemplates: {
    request: {
      url: '/notifications/email-templates',
      paginationField: 'next',
    },
  },
  Task: {
    transformation: {
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'number' },
      ],
    },
  },
  CustomObject: {
    transformation: {
      dataField: 'definitions',
    },
  },
  [CUSTOM_OBJECT_DEFINITION_TYPE]: {
    transformation: {
      idFields: ['type'],
    },
  },
  StandardObject: {
    request: {
      url: '/objects/definitions/com_zuora',
    },
    transformation: {
      dataField: 'definitions',
    },
  },
  HostedPages: {
    transformation: {
      dataField: 'hostedpages',
    },
  },
  HostedPage: {
    transformation: {
      idFields: ['pageType', 'pageName'],
      fieldTypeOverrides: [
        { fieldName: 'pageVersion', fieldType: 'number' },
      ],
    },
  },
  [LIST_ALL_SETTINGS_TYPE]: {
    transformation: {
      dataField: '.',
    },
  },
  SettingItemWithOperationsInformation: {
    transformation: {
      idFields: ['key'],
    },
  },
  CatalogProduct: {
    transformation: {
      dataField: 'products',
    },
  },
  AccountingCodeItem: {
    transformation: {
      idFields: ['type', 'name'],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  ProductType: {
    transformation: {
      idFields: ['sku'],
      fileNameFields: ['name'],
      fieldTypeOverrides: [
        { fieldName: 'productRatePlans', fieldType: 'list<ProductRatePlanType>' },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
      standaloneFields: [
        { fieldName: 'productRatePlans' },
      ],
    },
  },
  ProductRatePlanType: {
    transformation: {
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  AccountingPeriod: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'fiscalYear', fieldType: 'number' },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  GETAccountingPeriodType: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'fiscalYear', fieldType: 'number' },
      ],
    },
  },
  GETProductRatePlanChargePricingType: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'price', fieldType: 'number' },
        { fieldName: 'discountPercentage', fieldType: 'number' },
        { fieldName: 'includedUnits', fieldType: 'number' },
        { fieldName: 'overagePrice', fieldType: 'number' },
      ],
    },
  },
  GETProductRatePlanChargePricingTierType: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'price', fieldType: 'number' },
        { fieldName: 'startingUnit', fieldType: 'number' },
        { fieldName: 'endingUnit', fieldType: 'number' },
      ],
    },
  },
  GETProductRatePlanChargeType: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'defaultQuantity', fieldType: 'number' },
      ],
      // omitting and not hiding because the type is used inside an array, and can cause
      // merge conflicts
      fieldsToOmit: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  SequenceSet: {
    transformation: {
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },

  // settings endpoints - adding SETTINGS_TYPE_PREFIX to avoid conflicts with swagger-defined types
  [`${SETTINGS_TYPE_PREFIX}GatewayResponse`]: {
    request: {
      // for now relying on the specific param name from the swagger (id)
      url: '/settings/payment-gateways/{id}',
      dependsOn: [
        { pathParam: 'id', from: { type: `${SETTINGS_TYPE_PREFIX}PaymentGateways`, field: 'id' } },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}Currency`]: {
    transformation: {
      idFields: ['currencyCode'],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}PaymentTerm`]: {
    transformation: {
      idFields: ['type', 'name'],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}ReasonCode`]: {
    transformation: {
      idFields: ['reasonCodeTransactionType', 'reasonCodeName'],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}RevenueEventType`]: {
    transformation: {
      idFields: ['systemId'],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}revenueRecognitionRuleDtos`]: {
    transformation: {
      fieldTypeOverrides: [
        // the type only has additionalProperties - this allows the individual rules to be extracted
        { fieldName: 'revenueRecognitionRuleDtos', fieldType: `list<${SETTINGS_TYPE_PREFIX}RevenueRecognitionRule>` },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}Role`]: {
    transformation: {
      idFields: ['category', 'name'],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}RolesPage`]: {
    request: {
      url: '/settings/user-roles',
      queryParams: {
        size: '100',
        // the request fails if the page arg is not set
        // the pagination infra will increment it for the 2nd page
        page: '0',
      },
      paginationField: 'page',
    },
    transformation: {
      fieldTypeOverrides: [
        // the type specifies contents but the response has content
        { fieldName: 'content', fieldType: `list<${SETTINGS_TYPE_PREFIX}Role>` },
      ],
      dataField: 'content',
    },
  },
  [`${SETTINGS_TYPE_PREFIX}WorkflowObject`]: {
    request: {
      // for now relying on the specific param name from the swagger (workFlowId),
      // if it changes this should be updated accordingly
      url: '/settings/workflows/v1/{workFlowId}',
      dependsOn: [
        { pathParam: 'workFlowId', from: { type: 'Workflows', field: 'id' } },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}AllNotifications`]: {
    request: {
      url: '/settings/communication-profiles/{id}/notifications',
      dependsOn: [
        { pathParam: 'id', from: { type: `${SETTINGS_TYPE_PREFIX}CommunicationProfiles`, field: 'id' } },
      ],
    },
    transformation: {
      dataField: '.',
    },
  },
  [`${SETTINGS_TYPE_PREFIX}Notification`]: {
    transformation: {
      // TODO replace profileId with profile name to make this multienv-friendly
      idFields: ['eventName', 'name', 'profileId'],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
        { fieldName: 'eventId', fieldType: 'string' },
        { fieldName: 'emailTemplate', fieldType: 'string' },
      ],
    },
  },
}

const DEFAULT_SWAGGER_CONFIG: ZuoraApiConfig['swagger'] = {
  url: 'https://assets.zuora.com/zuora-documentation/swagger.yaml',
  typeNameOverrides: [
    { originalName: 'events__event_triggers@uub', newName: 'EventTriggers' },
    { originalName: 'notifications__email_templates@uub', newName: 'NotificationEmailTemplates' },
    { originalName: 'notifications__notification_definitions@uub', newName: 'NotificationDefinitions' },
    { originalName: 'workflows___workflow_id___export@uu_00123u_00125uu', newName: 'WorkflowExport' },
    { originalName: 'GETAccountingCodeItemWithoutSuccessType', newName: 'AccountingCodeItem' },
    { originalName: 'GETAccountingCodesType', newName: 'AccountingCodes' },
    { originalName: 'GETAccountingPeriodsType', newName: 'AccountingPeriods' },
    { originalName: 'GETAccountingPeriodWithoutSuccessType', newName: 'AccountingPeriod' },
    { originalName: 'GETAllCustomObjectDefinitionsInNamespaceResponse', newName: 'CustomObject' },
    { originalName: 'GETCatalogType', newName: 'CatalogProduct' },
    { originalName: 'GetHostedPagesType', newName: 'HostedPages' },
    { originalName: 'GetHostedPageType', newName: 'HostedPage' },
    { originalName: 'GETPaymentGatwaysResponse', newName: 'PaymentGateways' },
    { originalName: 'GETPublicEmailTemplateResponse', newName: 'PublicEmailTemplate' },
    { originalName: 'GETPublicNotificationDefinitionResponse', newName: 'PublicNotificationDefinition' },
    { originalName: 'GETSequenceSetResponse', newName: 'SequenceSet' },
    { originalName: 'GETSequenceSetsResponse', newName: 'SequenceSets' },
    { originalName: 'GetWorkflowsResponse', newName: 'Workflows' },
    { originalName: 'ListAllSettingsResponse', newName: LIST_ALL_SETTINGS_TYPE },
    { originalName: 'GETProductType', newName: 'ProductType' },
    { originalName: 'GETProductRatePlanType', newName: 'ProductRatePlanType' },
  ],
  additionalTypes: [
    { typeName: 'StandardObject', cloneFrom: 'CustomObject' },
  ],
}

export const DEFAULT_API_DEFINITIONS: ZuoraApiConfig = {
  swagger: DEFAULT_SWAGGER_CONFIG,
  typeDefaults: {
    transformation: {
      idFields: DEFAULT_ID_FIELDS,
      fieldsToOmit: FIELDS_TO_OMIT,
    },
  },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
}

// partial list - need to extend
// Note: since these types are returned from an endpoint and have some overlaps with the
// swagger-generated types, we prepend SETTINGS_TYPE_PREFIX to all type names to avoid conflicts.
export const DEFAULT_SETTINGS_INCLUDE_TYPES = [
  'AccountingRules',
  'AgingBucket',
  'AllNotifications',
  'AllPaymentTerms',
  'AllRevenueRecognition',
  'AllTaxCode',
  'ApplicationRules',
  'BatchAlias',
  'BillingCycleType',
  'BillingListPriceBase',
  'BillingPeriod',
  'BillingPeriodStart',
  'BillingRules',
  'ChargeModel',
  'ChargeType',
  'CommunicationProfiles',
  'Currencies',
  'DiscountSettings',
  'DocPrefix',
  'FxCurrency',
  'GatewayResponse',
  'GetTaxCompanies',
  'GlSegments',
  'HostedPaymentPages',
  'NumberAndSku',
  'PaymentGateways',
  'PaymentMethods',
  'PaymentRetryRules',
  'PaymentRules',
  'ReasonCodes',
  'RevenueEventTypes',
  'RevenueRecognitionModels',
  'revenueRecognitionRuleDtos',
  'RevenueRecognitionStatus',
  'RevenueStartDate',
  'RolesPage',
  'SegmentationRules',
  'SubscriptionSetting',
  'UnitsOfMeasureList',
]

export const DEFAULT_INCLUDE_TYPES: string[] = [
  'AccountingCodes',
  'AccountingPeriods',
  'CatalogProduct',
  'CustomObject',
  'EventTriggers',
  'HostedPages',
  'NotificationDefinitions',
  'NotificationEmailTemplates',
  'PaymentGateways',
  'SequenceSets',
  'StandardObject',
  'WorkflowExport',
]

export const configType = createMatchingObjectType<ZuoraConfig>({
  elemID: new ElemID(ZUORA_BILLING),
  fields: {
    [CLIENT_CONFIG]: {
      type: createClientConfigType(ZUORA_BILLING),
    },
    [FETCH_CONFIG]: {
      type: createUserFetchConfigType(
        ZUORA_BILLING,
        { settingsIncludeTypes: { type: new ListType(BuiltinTypes.STRING) } },
      ),
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.DEFAULT]: {
          includeTypes: DEFAULT_INCLUDE_TYPES,
          settingsIncludeTypes: DEFAULT_SETTINGS_INCLUDE_TYPES,
        },
      },
    },
    [API_DEFINITIONS_CONFIG]: {
      type: createSwaggerAdapterApiConfigType({
        adapter: ZUORA_BILLING,
      }),
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_API_DEFINITIONS,
      },
    },
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: ZuoraFetchConfig
  [API_DEFINITIONS_CONFIG]: ZuoraApiConfig
}
