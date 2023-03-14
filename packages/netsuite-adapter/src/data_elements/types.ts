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
import { ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'

export const ITEM_TYPE_ID = '-10'
export const TRANSACTION_TYPE_ID = '-30'
const FIELD_TYPE = '-124'
const SCRIPT_TYPE = '-417'

// Was taken from https://<account_id>.app.netsuite.com/app/help/helpcenter.nl?fid=section_n3432681.html&whence=
const ORIGINAL_TYPES_TO_INTERNAL_ID: Record<string, string> = {
  account: '-112',
  accountingPeriod: '-105',
  address: '-289',
  advInterCompanyJournalEntry: TRANSACTION_TYPE_ID,
  assemblyBuild: TRANSACTION_TYPE_ID,
  assemblyItem: ITEM_TYPE_ID,
  assemblyUnbuild: TRANSACTION_TYPE_ID,
  billingAccount: '-333',
  billingSchedule: '-141',
  bin: '-242',
  binTransfer: TRANSACTION_TYPE_ID,
  binWorksheet: TRANSACTION_TYPE_ID,
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
  cashRefund: TRANSACTION_TYPE_ID,
  cashSale: TRANSACTION_TYPE_ID,
  charge: '-290',
  check: TRANSACTION_TYPE_ID,
  classification: '-101',
  consolidatedExchangeRate: '-322',
  contact: '-6',
  contactCategory: '-158',
  contactRole: '-157',
  costCategory: '-155',
  creditMemo: TRANSACTION_TYPE_ID,
  crmCustomField: FIELD_TYPE,
  currency: '-122',
  customer: '-2',
  customerCategory: '-109',
  customerDeposit: TRANSACTION_TYPE_ID,
  customerMessage: '-161',
  customerPayment: TRANSACTION_TYPE_ID,
  customerRefund: TRANSACTION_TYPE_ID,
  customerStatus: '-104',
  customList: '-123',
  customRecordCustomField: FIELD_TYPE,
  customRecordType: '-123',
  customTransaction: TRANSACTION_TYPE_ID,
  department: '-102',
  deposit: TRANSACTION_TYPE_ID,
  depositApplication: TRANSACTION_TYPE_ID,
  descriptionItem: ITEM_TYPE_ID,
  discountItem: ITEM_TYPE_ID,
  downloadItem: ITEM_TYPE_ID,
  employee: '-4',
  entityCustomField: FIELD_TYPE,
  estimate: TRANSACTION_TYPE_ID,
  expenseCategory: '-126',
  expenseReport: TRANSACTION_TYPE_ID,
  fairValuePrice: '-332',
  generalToken: '-540',
  giftCertificateItem: ITEM_TYPE_ID,
  globalAccountMapping: '-250',
  hcmJob: '-355',
  inboundShipment: '-427',
  interCompanyJournalEntry: TRANSACTION_TYPE_ID,
  interCompanyTransferOrder: TRANSACTION_TYPE_ID,
  inventoryAdjustment: TRANSACTION_TYPE_ID,
  inventoryCostRevaluation: TRANSACTION_TYPE_ID,
  inventoryDetail: '-260',
  inventoryItem: ITEM_TYPE_ID,
  inventoryNumber: '-266',
  inventoryTransfer: TRANSACTION_TYPE_ID,
  invoice: TRANSACTION_TYPE_ID,
  issue: '-26',
  itemAccountMapping: '-251',
  itemCustomField: FIELD_TYPE,
  itemDemandPlan: '-246',
  itemFulfillment: TRANSACTION_TYPE_ID,
  itemGroup: ITEM_TYPE_ID,
  itemNumberCustomField: FIELD_TYPE,
  itemOptionCustomField: FIELD_TYPE,
  itemReceipt: TRANSACTION_TYPE_ID,
  itemRevision: '-269',
  itemSupplyPlan: '-247',
  job: '-7',
  jobType: '-177',
  journalEntry: TRANSACTION_TYPE_ID,
  kitItem: ITEM_TYPE_ID,
  location: '-103',
  lotNumberedAssemblyItem: ITEM_TYPE_ID,
  lotNumberedInventoryItem: ITEM_TYPE_ID,
  manufacturingCostTemplate: '-294',
  manufacturingOperationTask: '-36',
  manufacturingRouting: '-288',
  markupItem: ITEM_TYPE_ID,
  nexus: '-400',
  nonInventoryPurchaseItem: ITEM_TYPE_ID,
  nonInventoryResaleItem: ITEM_TYPE_ID,
  nonInventorySaleItem: ITEM_TYPE_ID,
  note: '-303',
  noteType: '-180',
  opportunity: '-31',
  otherChargePurchaseItem: ITEM_TYPE_ID,
  otherChargeResaleItem: ITEM_TYPE_ID,
  otherChargeSaleItem: ITEM_TYPE_ID,
  otherCustomField: FIELD_TYPE,
  otherNameCategory: '-181',
  partner: '-5',
  partnerCategory: '-182',
  paycheck: TRANSACTION_TYPE_ID,
  paycheckJournal: TRANSACTION_TYPE_ID,
  paymentCard: '-538',
  paymentCardToken: '-539',
  paymentItem: ITEM_TYPE_ID,
  paymentMethod: '-183',
  payrollItem: '-265',
  phoneCall: '-22',
  priceLevel: '-186',
  pricingGroup: '-187',
  projectTask: '-27',
  promotionCode: '-121',
  purchaseOrder: TRANSACTION_TYPE_ID,
  purchaseRequisition: TRANSACTION_TYPE_ID,
  resourceAllocation: '-28',
  returnAuthorization: TRANSACTION_TYPE_ID,
  salesOrder: TRANSACTION_TYPE_ID,
  salesRole: '-191',
  salesTaxItem: '-128',
  serializedAssemblyItem: ITEM_TYPE_ID,
  serializedInventoryItem: ITEM_TYPE_ID,
  servicePurchaseItem: ITEM_TYPE_ID,
  serviceResaleItem: ITEM_TYPE_ID,
  serviceSaleItem: ITEM_TYPE_ID,
  solution: '-25',
  statisticalJournalEntry: TRANSACTION_TYPE_ID,
  subsidiary: '-117',
  subtotalItem: ITEM_TYPE_ID,
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
  transactionBodyCustomField: FIELD_TYPE,
  transactionColumnCustomField: FIELD_TYPE,
  transferOrder: TRANSACTION_TYPE_ID,
  unitsType: '-201',
  usage: '-362',
  vendor: '-3',
  vendorBill: TRANSACTION_TYPE_ID,
  vendorCategory: '-110',
  vendorCredit: TRANSACTION_TYPE_ID,
  vendorPayment: TRANSACTION_TYPE_ID,
  vendorReturnAuthorization: TRANSACTION_TYPE_ID,
  winLossReason: '-203',
  workOrder: TRANSACTION_TYPE_ID,
  workOrderClose: TRANSACTION_TYPE_ID,
  workOrderCompletion: TRANSACTION_TYPE_ID,
  workOrderIssue: TRANSACTION_TYPE_ID,
}

const MANUALLY_MAPPED_TYPES_TO_INTERNAL_IDS: Record<string, string> = {
  // Some types from the original map were wrong and some were missing.
  // This map was manually added with corrected types to ids.
  role: '-264',
  workflow: '-129',
  vendor: '-9',
  customrecordtype: '-123',
  priceLevel: ITEM_TYPE_ID,
  scheduledscript: SCRIPT_TYPE,
  workflowactionscript: SCRIPT_TYPE,
  clientscript: SCRIPT_TYPE,
  suitelet: SCRIPT_TYPE,
  portlet: SCRIPT_TYPE,
  bundleinstallationscript: SCRIPT_TYPE,
  restlet: SCRIPT_TYPE,
  massupdatescript: SCRIPT_TYPE,
  mapreducescript: SCRIPT_TYPE,
  customSegment: FIELD_TYPE,
  customsegment: FIELD_TYPE,
  usereventscript: SCRIPT_TYPE,
  sdfinstallationscript: SCRIPT_TYPE,
}


export const TYPES_TO_INTERNAL_ID: Record<string, string> = {
  ...ORIGINAL_TYPES_TO_INTERNAL_ID,
  ...MANUALLY_MAPPED_TYPES_TO_INTERNAL_IDS,
}

export const INTERNAL_ID_TO_TYPES: Record<string, string[]> = _(TYPES_TO_INTERNAL_ID)
  .entries()
  .groupBy(([_type, internalId]) => internalId)
  .mapValues(values => values.map(([type]) => type))
  .value()

export const ITEM_TYPE_TO_SEARCH_STRING: Record<string, string> = {
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

// This is used for constructing a unique identifier for data types
// field using multiple other fields
export const TYPE_TO_ID_FIELD_PATHS: Record<string, string[][]> = {
  accountingPeriod: [['periodName'], ['fiscalCalendar', 'name']],
  nexus: [['country'], ['state', 'name']],
  account: [['acctName'], ['acctNumber']],
}

export const IDENTIFIER_FIELD = 'identifier'

export const TYPE_TO_IDENTIFIER: Record<string, string> = {
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
  ...Object.fromEntries(Object.keys(ITEM_TYPE_TO_SEARCH_STRING).map(type => [type, 'itemId'])),
  ...Object.fromEntries(Object.keys(TYPE_TO_ID_FIELD_PATHS).map(type => [type, IDENTIFIER_FIELD])),
}

export const getTypeIdentifier = (type: ObjectType): string => (
  type.fields[IDENTIFIER_FIELD] !== undefined
    ? IDENTIFIER_FIELD
    : TYPE_TO_IDENTIFIER[type.elemID.name]
)

export const SUPPORTED_TYPES = Object.keys(TYPE_TO_IDENTIFIER)
