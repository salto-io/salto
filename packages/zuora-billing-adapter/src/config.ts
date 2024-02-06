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
import { ElemID, CORE_ANNOTATIONS, ListType } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { client as clientUtils, config as configUtils, definitions, elements } from '@salto-io/adapter-components'
import { ZUORA_BILLING, CUSTOM_OBJECT_DEFINITION_TYPE, LIST_ALL_SETTINGS_TYPE, SETTINGS_TYPE_PREFIX, TASK_TYPE, WORKFLOW_DETAILED_TYPE, WORKFLOW_EXPORT_TYPE, PRODUCT_RATE_PLAN_TYPE, ACCOUNTING_CODE_ITEM_TYPE } from './constants'

const { createClientConfigType } = clientUtils
const {
  createSwaggerAdapterApiConfigType,
  createTypeNameOverrideConfigType,
} = configUtils

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type ZuoraClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type ZuoraFetchConfig = definitions.UserFetchConfig

type ZuoraSettingsSwaggerConfig = {
  typeNameOverrides?: configUtils.TypeNameOverrideConfig[]
}
export type ZuoraApiConfig = configUtils.AdapterSwaggerApiConfig & {
  settingsSwagger?: ZuoraSettingsSwaggerConfig
}

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
  [WORKFLOW_EXPORT_TYPE]: {
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
  Linkage: {
    transformation: {
      // defining explicitly to avoid nesting under additionalProperties
      fieldTypeOverrides: [
        { fieldName: 'internal_group', fieldType: 'string' },
      ],
    },
  },
  Workflows: {
    request: {
      url: '/workflows',
      paginationField: 'pagination.next_page',
    },
  },
  [WORKFLOW_DETAILED_TYPE]: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'status', fieldType: 'string' },
      ],
    },
  },
  PublicEmailTemplate: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'eventCategory', fieldType: 'number' },
        // defining explicitly to avoid nesting under additionalProperties
        { fieldName: 'useAdditionalAddresses', fieldType: 'boolean' },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  EventTriggers: {
    request: {
      url: '/events/event-triggers',
      paginationField: 'next',
    },
  },
  EventTrigger: {
    transformation: {
      idFields: ['baseObject', 'eventType.name'],
    },
  },
  EventType: {
    transformation: {
      fieldTypeOverrides: [
        // defining explicitly to avoid nesting under additionalProperties
        { fieldName: 'namespace', fieldType: 'string' },
      ],
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
  [TASK_TYPE]: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'delay', fieldType: 'number' },
      ],
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
    request: {
      url: '/v1/catalog/products',
      paginationField: 'nextPage',
    },
    transformation: {
      dataField: 'products',
    },
  },
  [ACCOUNTING_CODE_ITEM_TYPE]: {
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
        { fieldName: 'productRatePlans', fieldType: `list<${PRODUCT_RATE_PLAN_TYPE}>` },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
      standaloneFields: [
        { fieldName: 'productRatePlans' },
      ],
    },
  },
  [PRODUCT_RATE_PLAN_TYPE]: {
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
        // defining explicitly to avoid nesting under additionalProperties
        { fieldName: 'fiscalQuarter', fieldType: 'number' },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
      fieldsToOmit: [
        ...FIELDS_TO_OMIT,
        { fieldName: 'runTrialBalanceEnd', fieldType: 'string' },
        { fieldName: 'runTrialBalanceStart', fieldType: 'string' },
        { fieldName: 'runTrialBalanceStatus', fieldType: 'string' },
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
        { fieldName: 'discountAmount', fieldType: 'number' },
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
        ...FIELDS_TO_OMIT,
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  PublicNotificationDefinition_filterRule: {
    transformation: {
      // explicitly define the fields so that we can hide them (missing in swagger)
      fieldTypeOverrides: [
        { fieldName: 'createdBy', fieldType: 'string' },
        { fieldName: 'createdOn', fieldType: 'string' },
        { fieldName: 'scheduled', fieldType: 'boolean' },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
        { fieldName: 'createdBy' },
        { fieldName: 'createdOn' },
        { fieldName: 'scheduled' },
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
    transformation: {
      idFields: ['gatewayName'],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}Gateway`]: {
    transformation: {
      idFields: ['gatewayName'],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
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
      // explicitly define the field so that we can hide it (missing in swagger)
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'string' },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}ReasonCode`]: {
    transformation: {
      idFields: ['reasonCodeTransactionType', 'reasonCodeName'],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}RevenueEventType`]: {
    transformation: {
      idFields: ['systemId'],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}Segment`]: {
    transformation: {
      idFields: ['segmentName'],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}SegmentationRule`]: {
    transformation: {
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  // this type has only 'additionalProperties',
  // but because we want to replace 'segmentName' with a reference it can't be nested
  [`${SETTINGS_TYPE_PREFIX}RuleDetail`]: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'segmentId', fieldType: 'string' },
        { fieldName: 'segmentName', fieldType: 'string' },
        { fieldName: 'transactionType', fieldType: 'string' },
      ],
      // omitting and not hiding because the type is used inside an array, and can cause
      // merge conflicts
      fieldsToOmit: [
        ...FIELDS_TO_OMIT,
        { fieldName: 'segmentId' },
      ],
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
  [`${SETTINGS_TYPE_PREFIX}RevenueRecognitionRule`]: {
    transformation: {
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}CreditMemoTransactionRule`]: {
    transformation: {
      fieldTypeOverrides: [
        // defining explicitly to avoid nesting under additionalProperties
        { fieldName: 'usedTheSameTransactionRuleAsCreditMemoItem', fieldType: 'boolean' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}Role`]: {
    transformation: {
      idFields: ['category', 'name'],
      // defining explicitly to avoid nesting under additionalProperties
      fieldTypeOverrides: [
        { fieldName: 'description', fieldType: 'string' },
        { fieldName: 'entityId', fieldType: 'string' },
        { fieldName: 'custom', fieldType: 'boolean' },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}Attribute`]: {
    transformation: {
      fieldsToOmit: [
        ...FIELDS_TO_OMIT,
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}Codes`]: {
    transformation: {
      idFields: ['code'],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}TaxCode`]: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'taxCompanyId', fieldType: 'string' },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}TaxEngines`]: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'taxEngines', fieldType: `list<${SETTINGS_TYPE_PREFIX}TaxEngine>` },
      ],
      standaloneFields: [
        { fieldName: 'taxEngines' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}TaxEngine`]: {
    transformation: {
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}TaxCompany`]: {
    transformation: {
      fieldTypeOverrides: [
        // defining explicitly to avoid nesting under additionalProperties
        { fieldName: 'postalCode', fieldType: 'string' },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}UnitOfMeasure`]: {
    transformation: {
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}DiscountSetting`]: {
    transformation: {
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
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
  [`${SETTINGS_TYPE_PREFIX}CommunicationProfile`]: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'string' },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
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
      // defining explicitly to avoid nesting under additionalProperties
      fieldTypeOverrides: [
        { fieldName: 'calloutPreemptiveAuth', fieldType: 'boolean' },
        { fieldName: 'useCustomRequestBody', fieldType: 'boolean' },
      ],
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
        { fieldName: 'eventId', fieldType: 'string' },
        { fieldName: 'emailTemplate', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}HostedPaymentPage`]: {
    transformation: {
      fieldsToHide: [
        { fieldName: 'id', fieldType: 'string' },
      ],
    },
  },
  [`${SETTINGS_TYPE_PREFIX}AccountingRules`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}BillingCycleType`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}BillingListPriceBase`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}BillingPeriod`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}BillingPeriodStart`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}BillingRules`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}ChargeModel`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}ChargeType`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}DocPrefix`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}FxCurrency`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}NumberAndSku`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}PaymentMethods`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}PaymentRules`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}RevenueRecognitionModels`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}RevenueRecognitionStatus`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}RevenueStartDate`]: {
    transformation: {
      isSingleton: true,
    },
  },
  [`${SETTINGS_TYPE_PREFIX}SubscriptionSetting`]: {
    transformation: {
      isSingleton: true,
    },
  },
}

const DEFAULT_SWAGGER_CONFIG: ZuoraApiConfig['swagger'] = {
  url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/main/zuora_billing/swagger.yaml',
  typeNameOverrides: [
    { originalName: 'events__event_triggers@uub', newName: 'EventTriggers' },
    { originalName: 'notifications__email_templates@uub', newName: 'NotificationEmailTemplates' },
    { originalName: 'notifications__notification_definitions@uub', newName: 'NotificationDefinitions' },
    { originalName: 'ExportWorkflowVersionResponse', newName: WORKFLOW_EXPORT_TYPE },
    { originalName: 'GETAccountingCodeItemWithoutSuccessType', newName: ACCOUNTING_CODE_ITEM_TYPE },
    { originalName: 'GETAccountingCodesType', newName: 'AccountingCodes' },
    { originalName: 'GETAccountingPeriodsType', newName: 'AccountingPeriods' },
    { originalName: 'GETAccountingPeriodWithoutSuccessType', newName: 'AccountingPeriod' },
    { originalName: 'GETAllCustomObjectDefinitionsInNamespaceResponse', newName: 'CustomObject' },
    { originalName: 'GETCatalogType', newName: 'CatalogProduct' },
    { originalName: 'GetHostedPagesType', newName: 'HostedPages' },
    { originalName: 'GetHostedPageType', newName: 'HostedPage' },
    { originalName: 'GETPaymentGatwaysResponse', newName: 'PaymentGateways' },
    { originalName: 'GETAPaymentGatwayResponse', newName: 'PaymentGatewayResponse' },
    { originalName: 'GETPublicEmailTemplateResponse', newName: 'PublicEmailTemplate' },
    { originalName: 'GETPublicNotificationDefinitionResponse', newName: 'PublicNotificationDefinition' },
    { originalName: 'GETSequenceSetResponse', newName: 'SequenceSet' },
    { originalName: 'GETSequenceSetsResponse', newName: 'SequenceSets' },
    { originalName: 'GetWorkflowsResponse', newName: 'Workflows' },
    { originalName: 'ListAllSettingsResponse', newName: LIST_ALL_SETTINGS_TYPE },
    { originalName: 'GETProductType', newName: 'ProductType' },
    { originalName: 'GETProductRatePlanType', newName: PRODUCT_RATE_PLAN_TYPE },
  ],
  additionalTypes: [
    { typeName: 'StandardObject', cloneFrom: 'CustomObject' },
  ],
}

const SETTINGS_SWAGGER_CONFIG: ZuoraApiConfig['settingsSwagger'] = {
  typeNameOverrides: [
    { originalName: 'settings__tax_engines@uub', newName: `${SETTINGS_TYPE_PREFIX}TaxEngines` },
    // map to old name for backward-compatibility reasons -
    // can be updated once all workspaces are migrated to SALTO-1792
    { originalName: `${SETTINGS_TYPE_PREFIX}RevenueRecognitionRuleObject`, newName: `${SETTINGS_TYPE_PREFIX}revenueRecognitionRuleDtos` },
  ],
}

// partial list - need to extend
// Note: since these types are returned from an endpoint and have some overlaps with the
// swagger-generated types, we prepend SETTINGS_TYPE_PREFIX to all type names to avoid conflicts.
export const SETTING_TYPES = {
  [`${SETTINGS_TYPE_PREFIX}AccountingRules`]: [`${SETTINGS_TYPE_PREFIX}AccountingRules`],
  [`${SETTINGS_TYPE_PREFIX}Bucket`]: [`${SETTINGS_TYPE_PREFIX}AgingBucket`],
  [`${SETTINGS_TYPE_PREFIX}Notification`]: [`${SETTINGS_TYPE_PREFIX}AllNotifications`],
  [`${SETTINGS_TYPE_PREFIX}PaymentTerm`]: [`${SETTINGS_TYPE_PREFIX}AllPaymentTerms`],
  [`${SETTINGS_TYPE_PREFIX}Codes`]: [`${SETTINGS_TYPE_PREFIX}AllRevenueRecognition`],
  [`${SETTINGS_TYPE_PREFIX}TaxCode`]: [`${SETTINGS_TYPE_PREFIX}AllTaxCode`],
  [`${SETTINGS_TYPE_PREFIX}ApplicationRules`]: [`${SETTINGS_TYPE_PREFIX}ApplicationRules`],
  [`${SETTINGS_TYPE_PREFIX}SingleAlias`]: [`${SETTINGS_TYPE_PREFIX}BatchAlias`],
  [`${SETTINGS_TYPE_PREFIX}BillingCycleType`]: [`${SETTINGS_TYPE_PREFIX}BillingCycleType`],
  [`${SETTINGS_TYPE_PREFIX}BillingListPriceBase`]: [`${SETTINGS_TYPE_PREFIX}BillingListPriceBase`],
  [`${SETTINGS_TYPE_PREFIX}BillingPeriod`]: [`${SETTINGS_TYPE_PREFIX}BillingPeriod`],
  [`${SETTINGS_TYPE_PREFIX}BillingPeriodStart`]: [`${SETTINGS_TYPE_PREFIX}BillingPeriodStart`],
  [`${SETTINGS_TYPE_PREFIX}BillingRules`]: [`${SETTINGS_TYPE_PREFIX}BillingRules`],
  [`${SETTINGS_TYPE_PREFIX}ChargeModel`]: [`${SETTINGS_TYPE_PREFIX}ChargeModel`],
  [`${SETTINGS_TYPE_PREFIX}ChargeType`]: [`${SETTINGS_TYPE_PREFIX}ChargeType`],
  [`${SETTINGS_TYPE_PREFIX}CommunicationProfile`]: [`${SETTINGS_TYPE_PREFIX}CommunicationProfiles`],
  [`${SETTINGS_TYPE_PREFIX}Currency`]: [`${SETTINGS_TYPE_PREFIX}Currencies`],
  [`${SETTINGS_TYPE_PREFIX}DiscountSetting`]: [`${SETTINGS_TYPE_PREFIX}DiscountSettings`],
  [`${SETTINGS_TYPE_PREFIX}DocPrefix`]: [`${SETTINGS_TYPE_PREFIX}DocPrefix`],
  [`${SETTINGS_TYPE_PREFIX}FxCurrency`]: [`${SETTINGS_TYPE_PREFIX}FxCurrency`],
  [`${SETTINGS_TYPE_PREFIX}TaxCompany`]: [`${SETTINGS_TYPE_PREFIX}GetTaxCompanies`],
  [`${SETTINGS_TYPE_PREFIX}Segment`]: [`${SETTINGS_TYPE_PREFIX}GlSegments`],
  [`${SETTINGS_TYPE_PREFIX}HostedPaymentPage`]: [`${SETTINGS_TYPE_PREFIX}HostedPaymentPages`],
  [`${SETTINGS_TYPE_PREFIX}NumberAndSku`]: [`${SETTINGS_TYPE_PREFIX}NumberAndSku`],
  [`${SETTINGS_TYPE_PREFIX}Gateway`]: [`${SETTINGS_TYPE_PREFIX}PaymentGateways`],
  [`${SETTINGS_TYPE_PREFIX}PaymentMethods`]: [`${SETTINGS_TYPE_PREFIX}PaymentMethods`],
  [`${SETTINGS_TYPE_PREFIX}PaymentRetryRules`]: [`${SETTINGS_TYPE_PREFIX}PaymentRetryRules`],
  [`${SETTINGS_TYPE_PREFIX}PaymentRules`]: [`${SETTINGS_TYPE_PREFIX}PaymentRules`],
  [`${SETTINGS_TYPE_PREFIX}ReasonCode`]: [`${SETTINGS_TYPE_PREFIX}ReasonCodes`],
  [`${SETTINGS_TYPE_PREFIX}RevenueEventType`]: [`${SETTINGS_TYPE_PREFIX}RevenueEventTypes`],
  [`${SETTINGS_TYPE_PREFIX}RevenueRecognitionModels`]: [`${SETTINGS_TYPE_PREFIX}RevenueRecognitionModels`],
  [`${SETTINGS_TYPE_PREFIX}RevenueRecognitionRule`]: [`${SETTINGS_TYPE_PREFIX}revenueRecognitionRuleDtos`],
  [`${SETTINGS_TYPE_PREFIX}RevenueRecognitionStatus`]: [`${SETTINGS_TYPE_PREFIX}RevenueRecognitionStatus`],
  [`${SETTINGS_TYPE_PREFIX}RevenueStartDate`]: [`${SETTINGS_TYPE_PREFIX}RevenueStartDate`],
  [`${SETTINGS_TYPE_PREFIX}Role`]: [`${SETTINGS_TYPE_PREFIX}RolesPage`],
  [`${SETTINGS_TYPE_PREFIX}RuleDetail`]: [`${SETTINGS_TYPE_PREFIX}SegmentationRules`],
  [`${SETTINGS_TYPE_PREFIX}SubscriptionSetting`]: [`${SETTINGS_TYPE_PREFIX}SubscriptionSetting`],
  [`${SETTINGS_TYPE_PREFIX}UnitOfMeasure`]: [`${SETTINGS_TYPE_PREFIX}UnitsOfMeasureList`],
  [`${SETTINGS_TYPE_PREFIX}TaxEngine`]: [`${SETTINGS_TYPE_PREFIX}TaxEngines`],
}

export const SUPPORTED_TYPES = {
  AccountingCodeItem: ['AccountingCodes'],
  AccountingPeriod: ['AccountingPeriods'],
  ProductType: ['CatalogProduct'],
  CustomObject: ['CustomObject'],
  StandardObject: ['StandardObject'],
  EventTrigger: ['EventTriggers'],
  HostedPage: ['HostedPages'],
  PublicNotificationDefinition: ['NotificationDefinitions'],
  PublicEmailTemplate: ['NotificationEmailTemplates'],
  PaymentGatewayResponse: ['PaymentGateways'],
  SequenceSet: ['SequenceSets'],
  [WORKFLOW_EXPORT_TYPE]: [WORKFLOW_EXPORT_TYPE],
  ...SETTING_TYPES,
}

export const DEFAULT_API_DEFINITIONS: ZuoraApiConfig = {
  swagger: DEFAULT_SWAGGER_CONFIG,
  settingsSwagger: SETTINGS_SWAGGER_CONFIG,
  typeDefaults: {
    transformation: {
      idFields: DEFAULT_ID_FIELDS,
      fieldsToOmit: FIELDS_TO_OMIT,
      // TODO: change this to true for SALTO-3886.
      nestStandaloneInstances: false,
    },
  },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
  supportedTypes: SUPPORTED_TYPES,
}

export const DEFAULT_CONFIG: ZuoraConfig = {
  [FETCH_CONFIG]: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    hideTypes: true,
  },
  [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
}


const settingsSwaggerConfigType = createMatchingObjectType<Partial<ZuoraSettingsSwaggerConfig>>({
  elemID: new ElemID(ZUORA_BILLING, 'SettingsSwaggerConfig'),
  fields: {
    typeNameOverrides: {
      refType: new ListType(createTypeNameOverrideConfigType(ZUORA_BILLING)),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export const configType = createMatchingObjectType<Partial<ZuoraConfig>>({
  elemID: new ElemID(ZUORA_BILLING),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType(ZUORA_BILLING),
    },
    [FETCH_CONFIG]: {
      refType: definitions.createUserFetchConfigType(
        ZUORA_BILLING,
      ),
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createSwaggerAdapterApiConfigType({
        adapter: ZUORA_BILLING,
        additionalFields: {
          settingsSwagger: {
            refType: settingsSwaggerConfigType,
          },
        },
      }),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(DEFAULT_CONFIG, API_DEFINITIONS_CONFIG, `${FETCH_CONFIG}.hideTypes`),
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: ZuoraFetchConfig
  [API_DEFINITIONS_CONFIG]: ZuoraApiConfig
}
