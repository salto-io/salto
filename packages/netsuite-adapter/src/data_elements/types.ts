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
import { ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'

const ITEM_TYPES = [
  'assemblyItem',
  'lotNumberedAssemblyItem',
  'serializedAssemblyItem',
  'descriptionItem',
  'discountItem',
  'kitItem',
  'markupItem',
  'nonInventoryPurchaseItem',
  'nonInventorySaleItem',
  'nonInventoryResaleItem',
  'otherChargeSaleItem',
  'otherChargeResaleItem',
  'otherChargePurchaseItem',
  'paymentItem',
  'serviceResaleItem',
  'servicePurchaseItem',
  'serviceSaleItem',
  'subtotalItem',
  'inventoryItem',
  'lotNumberedInventoryItem',
  'serializedInventoryItem',
  'itemGroup',
  'giftCertificateItem',
  'downloadItem',
] as const

type ItemType = (typeof ITEM_TYPES)[number]

type TypeWithMultiFieldsIdentifier = 'accountingPeriod' | 'nexus' | 'account' | 'bin'

type TypeWithSingleFieldIdentifier =
  | 'subsidiary'
  | 'department'
  | 'classification'
  | 'location'
  | 'currency'
  | 'customer'
  | 'employee'
  | 'job'
  | 'manufacturingCostTemplate'
  | 'partner'
  | 'solution'

export type SupportedDataType = ItemType | TypeWithMultiFieldsIdentifier | TypeWithSingleFieldIdentifier

// Was taken from https://<account_id>.app.netsuite.com/app/help/helpcenter.nl?fid=section_n3432681.html&whence=
const TABLE_TO_INTERNAL_ID = {
  item: '-10',
  transaction: '-30',
  customfield: '-124',
  script: '-417',
  account: '-112',
  accountingPeriod: '-105',
  address: '-289',
  billingAccount: '-333',
  billingSchedule: '-141',
  bin: '-242',
  bom: '-422',
  bomRevision: '-423',
  budgetCategory: '-396',
  calendarEvent: '-20',
  campaign: '-24',
  campaignAudience: '-142',
  campaignCategory: '-143',
  campaignChannel: '-144',
  campaignFamily: '-145',
  campaignOffer: '-146',
  campaignResponse: '-130',
  campaignSearchEngine: '-148',
  campaignSubscription: '-149',
  campaignVertical: '-150',
  charge: '-290',
  classification: '-101',
  consolidatedExchangeRate: '-322',
  contact: '-6',
  contactCategory: '-158',
  contactRole: '-157',
  costCategory: '-155',
  currency: '-122',
  customer: '-2',
  customerCategory: '-109',
  customerMessage: '-161',
  customerStatus: '-104',
  customList: '-123',
  customRecordType: '-123',
  department: '-102',
  employee: '-4',
  expenseCategory: '-126',
  fairValuePrice: '-332',
  generalToken: '-540',
  globalAccountMapping: '-250',
  hcmJob: '-355',
  inboundShipment: '-427',
  inventoryDetail: '-260',
  inventoryNumber: '-266',
  issue: '-26',
  itemAccountMapping: '-251',
  itemDemandPlan: '-246',
  itemRevision: '-269',
  itemSupplyPlan: '-247',
  job: '-7',
  jobType: '-177',
  location: '-103',
  manufacturingCostTemplate: '-294',
  manufacturingOperationTask: '-36',
  manufacturingRouting: '-288',
  nexus: '-400',
  note: '-303',
  noteType: '-180',
  opportunity: '-31',
  otherNameCategory: '-181',
  partner: '-5',
  partnerCategory: '-182',
  paymentCard: '-538',
  paymentCardToken: '-539',
  paymentMethod: '-183',
  payrollItem: '-265',
  phoneCall: '-22',
  priceLevel: '-186',
  pricingGroup: '-187',
  projectTask: '-27',
  promotionCode: '-121',
  resourceAllocation: '-28',
  salesRole: '-191',
  salesTaxItem: '-128',
  solution: '-25',
  subsidiary: '-117',
  supportCase: '-23',
  supportCaseIssue: '-151',
  supportCaseOrigin: '-152',
  supportCasePriority: '-153',
  supportCaseStatus: '-132',
  supportCaseType: '-154',
  task: '-21',
  term: '-199',
  timeBill: '-256',
  timeEntry: '-295',
  timeSheet: '-292',
  unitsType: '-201',
  usage: '-362',
  vendor: '-3',
  vendorCategory: '-110',
  winLossReason: '-203',
} as const

const MANUALLY_TABLE_TO_INTERNAL_ID = {
  // Some types from the original map were wrong and some were missing.
  // This map was manually added with corrected types to ids.
  role: '-264',
  workflow: '-129',
  vendor: '-9',
  customrecordtype: TABLE_TO_INTERNAL_ID.customRecordType,
  priceLevel: TABLE_TO_INTERNAL_ID.item,
} as const

const ALL_TABLE_TO_INTERNAL_ID = {
  ...TABLE_TO_INTERNAL_ID,
  ...MANUALLY_TABLE_TO_INTERNAL_ID,
} as const

const ADDITIONAL_TABLES = ['entityStatus', 'campaignEvent'] as const

export type SuiteQLTableName = keyof typeof ALL_TABLE_TO_INTERNAL_ID | (typeof ADDITIONAL_TABLES)[number]

const TRANSACTION_TYPES = [
  'advInterCompanyJournalEntry',
  'assemblyBuild',
  'assemblyUnbuild',
  'binTransfer',
  'binWorksheet',
  'cashRefund',
  'cashSale',
  'check',
  'creditMemo',
  'customerDeposit',
  'customerPayment',
  'customerRefund',
  'customTransaction',
  'deposit',
  'depositApplication',
  'estimate',
  'expenseReport',
  'interCompanyJournalEntry',
  'interCompanyTransferOrder',
  'inventoryAdjustment',
  'inventoryCostRevaluation',
  'inventoryTransfer',
  'invoice',
  'itemFulfillment',
  'itemReceipt',
  'journalEntry',
  'paycheck',
  'paycheckJournal',
  'purchaseOrder',
  'purchaseRequisition',
  'returnAuthorization',
  'salesOrder',
  'statisticalJournalEntry',
  'transferOrder',
  'vendorBill',
  'vendorCredit',
  'vendorPayment',
  'vendorReturnAuthorization',
  'workOrder',
  'workOrderClose',
  'workOrderCompletion',
  'workOrderIssue',
]

const FIELD_TYPES = [
  'crmCustomField',
  'customRecordCustomField',
  'entityCustomField',
  'itemCustomField',
  'itemNumberCustomField',
  'itemOptionCustomField',
  'otherCustomField',
  'transactionBodyCustomField',
  'transactionColumnCustomField',
  'customSegment',
  'customsegment',
]

const SCRIPT_TYPES = [
  'scheduledscript',
  'workflowactionscript',
  'clientscript',
  'suitelet',
  'portlet',
  'bundleinstallationscript',
  'restlet',
  'massupdatescript',
  'mapreducescript',
  'usereventscript',
  'sdfinstallationscript',
]

export const TYPES_TO_INTERNAL_ID: Record<string, string> = {
  ...ALL_TABLE_TO_INTERNAL_ID,
  ...Object.fromEntries(TRANSACTION_TYPES.map(type => [type, TABLE_TO_INTERNAL_ID.transaction])),
  ...Object.fromEntries(FIELD_TYPES.map(type => [type, TABLE_TO_INTERNAL_ID.customfield])),
  ...Object.fromEntries(SCRIPT_TYPES.map(type => [type, TABLE_TO_INTERNAL_ID.script])),
  ...Object.fromEntries(ITEM_TYPES.map(type => [type, TABLE_TO_INTERNAL_ID.item])),
}

export const INTERNAL_ID_TO_TYPES: Record<string, string[]> = _(TYPES_TO_INTERNAL_ID)
  .entries()
  .groupBy(([_type, internalId]) => internalId)
  .mapValues(values => values.map(([type]) => type))
  .value()

export const ITEM_TYPE_TO_SEARCH_STRING: Record<ItemType, string> = {
  assemblyItem: '_assembly',
  lotNumberedAssemblyItem: '_assembly',
  serializedAssemblyItem: '_assembly',
  descriptionItem: '_description',
  discountItem: '_discount',
  kitItem: '_kit',
  markupItem: '_markup',
  nonInventoryPurchaseItem: '_nonInventoryItem',
  nonInventorySaleItem: '_nonInventoryItem',
  nonInventoryResaleItem: '_nonInventoryItem',
  otherChargeSaleItem: '_otherCharge',
  otherChargeResaleItem: '_otherCharge',
  otherChargePurchaseItem: '_otherCharge',
  paymentItem: '_payment',
  serviceResaleItem: '_service',
  servicePurchaseItem: '_service',
  serviceSaleItem: '_service',
  subtotalItem: '_subtotal',
  inventoryItem: '_inventoryItem',
  lotNumberedInventoryItem: '_inventoryItem',
  serializedInventoryItem: '_inventoryItem',
  itemGroup: '_itemGroup',
  giftCertificateItem: '_giftCertificateItem',
  downloadItem: '_downloadItem',
}

export const isItemType = (type: string): type is ItemType => type in ITEM_TYPE_TO_SEARCH_STRING

// This is used for constructing a unique identifier for data types
// field using multiple other fields
export const TYPE_TO_ID_FIELD_PATHS: Record<TypeWithMultiFieldsIdentifier, string[][]> = {
  accountingPeriod: [['periodName'], ['fiscalCalendar', 'name']],
  nexus: [['country'], ['state', 'name']],
  account: [['acctName'], ['acctNumber']],
  bin: [['location', 'name'], ['binNumber']],
}

export const isTypeWithMultiFieldsIdentifier = (type: string): type is TypeWithMultiFieldsIdentifier =>
  type in TYPE_TO_ID_FIELD_PATHS

export const IDENTIFIER_FIELD = 'identifier'

const TYPE_TO_SINGLE_FIELD_IDENTIFIER: Record<TypeWithSingleFieldIdentifier, string> = {
  subsidiary: 'name',
  department: 'name',
  classification: 'name',
  location: 'name',
  currency: 'name',
  customer: 'entityId',
  employee: 'entityId',
  job: 'entityId',
  manufacturingCostTemplate: 'name',
  partner: 'partnerCode',
  solution: 'solutionCode',
}

const ITEM_TYPE_TO_IDENTIFIER: Record<ItemType, 'itemId'> = {
  assemblyItem: 'itemId',
  lotNumberedAssemblyItem: 'itemId',
  serializedAssemblyItem: 'itemId',
  descriptionItem: 'itemId',
  discountItem: 'itemId',
  kitItem: 'itemId',
  markupItem: 'itemId',
  nonInventoryPurchaseItem: 'itemId',
  nonInventorySaleItem: 'itemId',
  nonInventoryResaleItem: 'itemId',
  otherChargeSaleItem: 'itemId',
  otherChargeResaleItem: 'itemId',
  otherChargePurchaseItem: 'itemId',
  paymentItem: 'itemId',
  serviceResaleItem: 'itemId',
  servicePurchaseItem: 'itemId',
  serviceSaleItem: 'itemId',
  subtotalItem: 'itemId',
  inventoryItem: 'itemId',
  lotNumberedInventoryItem: 'itemId',
  serializedInventoryItem: 'itemId',
  itemGroup: 'itemId',
  giftCertificateItem: 'itemId',
  downloadItem: 'itemId',
}

const TYPE_WITH_MULTI_FIELDS_TO_IDENTIFIER: Record<TypeWithMultiFieldsIdentifier, typeof IDENTIFIER_FIELD> = {
  accountingPeriod: IDENTIFIER_FIELD,
  account: IDENTIFIER_FIELD,
  nexus: IDENTIFIER_FIELD,
  bin: IDENTIFIER_FIELD,
}

const supportedTypesToIdentifier: Record<SupportedDataType, string> = {
  ...TYPE_TO_SINGLE_FIELD_IDENTIFIER,
  ...ITEM_TYPE_TO_IDENTIFIER,
  ...TYPE_WITH_MULTI_FIELDS_TO_IDENTIFIER,
}

export const TYPE_TO_IDENTIFIER: Record<string, string> = supportedTypesToIdentifier

export const getTypeIdentifier = (type: ObjectType): string =>
  type.fields[IDENTIFIER_FIELD] !== undefined ? IDENTIFIER_FIELD : TYPE_TO_IDENTIFIER[type.elemID.name]

export const SUPPORTED_TYPES = Object.keys(TYPE_TO_IDENTIFIER)
