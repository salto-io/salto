/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  ElemID,
  Field,
  isContainerType,
  isObjectType,
  isPrimitiveType,
  ListType,
  ObjectType,
  TypeElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { EMPLOYEE, NETSUITE, PARENT, RECORD_REF } from '../constants'
import { LocalFilterCreator } from '../filter'

const fieldNameToTypeName: Record<string, string | undefined> = {
  taxEngine: undefined,
  billableExpensesAcct: undefined,
  pageLogo: 'file',
  restrictToAccountingBookList: undefined,
  accountingContext: undefined,
  nexusId: 'nexus',
  nexus: 'nexus',
  logo: 'file',
  location: 'location',
  unitsType: 'unitsType',
  interCoAccount: undefined,
  unit: undefined,
  checkLayout: undefined,
  taxFiscalCalendar: undefined,
  taxAgency: undefined,
  fiscalCalendar: undefined,
  currency: 'currency',
  accountingBook: undefined,
  class: 'classification',
  deferralAcct: undefined,
  subsidiaryList: 'subsidiary',
  subsidiary: 'subsidiary',
  image: 'file',
  file: 'file',
  category1099misc: undefined,
  contact: 'contact',
  terms: 'term',
  department: 'department',
  region: undefined,
  createdFrom: undefined,
  postingPeriod: undefined,
  item: undefined,
  units: undefined,
  billOfMaterials: undefined,
  revision: undefined,
  billOfMaterialsRevision: undefined,
  vendor: 'vendor',
  cogsAccount: 'account',
  incomeAccount: 'account',
  intercoIncomeAccount: 'account',
  assetAccount: 'account',
  billQtyVarianceAcct: 'account',
  billPriceVarianceAcct: 'account',
  billExchRateVarianceAcct: 'account',
  gainLossAccount: 'account',
  salesTaxCode: undefined,
  wipVarianceAcct: 'account',
  purchaseTaxCode: undefined,
  scrapAcct: 'account',
  taxSchedule: undefined,
  wipAcct: 'account',
  stockUnit: undefined,
  purchaseUnit: undefined,
  saleUnit: undefined,
  billingSchedule: undefined,
  deferredRevenueAccount: 'account',
  revRecSchedule: undefined,
  defaultItemShipMethod: undefined,
  itemShipMethodList: undefined,
  scheduleBCode: undefined,
  issueProduct: undefined,
  softDescriptor: undefined,
  costCategory: 'costCategory',
  prodQtyVarianceAcct: 'account',
  prodPriceVarianceAcct: 'account',
  purchasePriceVarianceAcct: 'account',
  quantityPricingSchedule: undefined,
  pricingGroup: 'pricingGroup',
  intercoCogsAccount: 'account',
  itemRevenueCategory: undefined,
  unbuildVarianceAccount: 'account',
  revenueRecognitionRule: undefined,
  revRecForecastRule: undefined,
  revenueAllocationGroup: undefined,
  createRevenuePlansOn: undefined,
  dropshipExpenseAccount: 'account',
  preferredLocation: 'location',
  distributionNetwork: undefined,
  distributionCategory: undefined,
  shipPackage: undefined,
  supplyReplenishmentMethod: undefined,
  alternateDemandSourceItem: undefined,
  supplyType: undefined,
  supplyLotSizingMethod: undefined,
  demandSource: undefined,
  storeDisplayThumbnail: 'file',
  storeDisplayImage: 'file',
  storeItemTemplate: undefined,
  itemNumberOptionsList: undefined,
  itemOptions: undefined,
  vendorCurrency: 'currency',
  schedule: undefined,
  priceLevel: 'priceLevel',
  memberUnit: undefined,
  effectiveRevision: undefined,
  obsoleteRevision: undefined,
  amortizationTemplate: undefined,
  defaultForLocationList: undefined,
  inventoryCostTemplate: undefined,
  locationId: 'location',
  website: undefined,
  category: undefined,
  binNumber: undefined,
  consumptionUnit: undefined,
  hierarchyVersion: undefined,
  hierarchyNode: undefined,
  project: undefined,
  initialTerms: undefined,
  recurrenceTerms: 'term',
  transaction: undefined,
  paymentTerms: 'term',
  milestoneTerms: 'term',
  projectTask: 'projectTask',
  company: undefined,
  supportCase: 'supportCase',
  organizer: undefined,
  owner: undefined,
  attendee: undefined,
  resource: undefined,
  employee: EMPLOYEE,
  customer: 'customer',
  payrollItem: 'payrollItem',
  temporaryLocalJurisdiction: undefined,
  temporaryStateJurisdiction: undefined,
  vertical: undefined,
  audience: undefined,
  offer: undefined,
  promotionCode: 'promotionCode',
  itemList: undefined,
  family: undefined,
  searchEngine: undefined,
  price: 'price',
  campaignGroup: undefined,
  template: undefined,
  subscription: undefined,
  channel: undefined,
  promoCode: undefined,
  caseTaskEvent: undefined,
  entity: undefined,
  leadSource: 'leadSource',
  campaignEvent: 'campaignEvent',
  subsidiaryTaxRegNum: undefined,
  state: 'state',
  taxAgencyPst: undefined,
  taxCode: undefined,
  parentNexus: 'nexus',
  entityTaxRegNum: undefined,
  salesRep: undefined,
  partner: 'partner',
  account: 'account',
  discountItem: 'discountItem',
  taxItem: undefined,
  messageSel: undefined,
  paymentOption: undefined,
  paymentProcessingProfile: undefined,
  billAddressList: undefined,
  shipMethod: undefined,
  shippingTaxCode: undefined,
  handlingTaxCode: undefined,
  salesGroup: undefined,
  paymentMethod: 'paymentMethod',
  creditCard: undefined,
  creditCardProcessor: undefined,
  job: 'job',
  giftCert: undefined,
  catchUpPeriod: undefined,
  chargeType: undefined,
  chargesList: 'charge',
  salesRole: 'salesRole',
  partnerRole: undefined,
  taxType: 'taxType',
  billingAccount: 'billingAccount',
  opportunity: 'opportunity',
  shipAddressList: undefined,
  itemCostDiscount: undefined,
  itemCostTaxCode: undefined,
  expCostDiscount: undefined,
  timeDiscount: undefined,
  expCostTaxCode: undefined,
  timeTaxCode: undefined,
  subscriptionLine: undefined,
  shipAddress: undefined,
  authCode: undefined,
  couponCode: 'couponCode',
  sourceAddressRef: undefined,
  destinationAddressRef: undefined,
  shippingMethodRef: undefined,
  salesOrder: 'salesOrder',
  billTo: undefined,
  timeRecord: undefined,
  billingItem: undefined,
  transactionLine: undefined,
  salesOrderLine: undefined,
  invoice: 'invoice',
  invoiceLine: undefined,
  rule: undefined,
  voidJournal: undefined,
  payeeAddressList: undefined,
  contactSource: undefined,
  supervisor: EMPLOYEE,
  assistant: undefined,
  role: 'role',
  entityStatus: undefined,
  representingSubsidiary: 'subsidiary',
  territory: undefined,
  prefCCProcessor: undefined,
  shippingItem: undefined,
  accessRole: undefined,
  assignedWebSite: undefined,
  campaignCategory: 'campaignCategory',
  sourceWebSite: undefined,
  receivablesAccount: undefined,
  drAccount: 'account',
  fxAccount: 'account',
  openingBalanceAccount: 'account',
  defaultTaxReg: undefined,
  salesReadiness: undefined,
  buyingReason: undefined,
  buyingTimeFrame: undefined,
  cardState: undefined,
  group: undefined,
  level: undefined,
  address: 'address',
  arAcct: 'account',
  deposit: 'deposit',
  expenseAccount: 'account',
  emailEmployees: undefined,
  billingClass: undefined,
  workplace: undefined,
  approver: undefined,
  timeApprover: undefined,
  employeeType: undefined,
  terminationReason: undefined,
  timeOffPlan: undefined,
  employeeStatus: undefined,
  maritalStatus: undefined,
  ethnicity: undefined,
  purchaseOrderApprover: undefined,
  workCalendar: undefined,
  defaultExpenseReportCurrency: 'currency',
  defaultAcctCorpCardExp: undefined,
  entityCurrency: 'currency',
  selectedRole: 'role',
  education: undefined,
  position: undefined,
  employmentCategory: undefined,
  reportsTo: undefined,
  forecastType: undefined,
  expenseAcct: 'account',
  expenseReportCurrency: 'currency',
  acctCorpCardExp: undefined,
  approvalStatus: undefined,
  nextApprover: undefined,
  expMediaItem: undefined,
  liabilityAccount: 'account',
  sourceAccount: 'account',
  destinationAccount: 'account',
  parentExpenseAlloc: undefined,
  toSubsidiary: 'subsidiary',
  lineSubsidiary: 'subsidiary',
  amortizationSched: undefined,
  scheduleNum: undefined,
  tax1Acct: undefined,
  incoterm: undefined,
  transferLocation: 'location',
  adjLocation: 'location',
  issueInventoryNumber: undefined,
  toBinNumber: undefined,
  inventoryStatus: undefined,
  toInventoryStatus: undefined,
  componentItem: undefined,
  revReclassFXAccount: 'account',
  intercoDefRevAccount: 'account',
  secondaryUnitsType: 'unitsType',
  secondaryBaseUnit: undefined,
  secondaryStockUnit: undefined,
  secondarySaleUnit: undefined,
  secondaryPurchaseUnit: undefined,
  secondaryConsumptionUnit: undefined,
  issueType: undefined,
  product: undefined,
  module: undefined,
  productTeam: undefined,
  source: undefined,
  reportedBy: undefined,
  reproduce: undefined,
  versionBroken: undefined,
  buildBroken: undefined,
  versionTarget: undefined,
  buildTarget: undefined,
  versionFixed: undefined,
  buildFixed: undefined,
  severity: undefined,
  priority: undefined,
  assigned: undefined,
  reviewer: undefined,
  issueStatus: undefined,
  issueTagsList: undefined,
  emailCellsList: undefined,
  version: 'version',
  build: undefined,
  issueNumber: undefined,
  requestedBy: undefined,
  inboundShipment: 'inboundShipment',
  itemFulfillment: 'itemFulfillment',
  sourceLocation: 'location',
  language: undefined,
  jobType: 'jobType',
  period: undefined,
  jobItem: undefined,
  estimateRevRecTemplate: undefined,
  projectExpenseType: undefined,
  jobResource: undefined,
  timeApproval: undefined,
  billingRateCard: undefined,
  projectManager: undefined,
  taxAccount: 'account',
  lineTaxCode: undefined,
  weightUnit: undefined,
  locationlookup: undefined,
  serialNumber: undefined,
  manufacturingWorkCenter: undefined,
  manufacturingCostTemplate: 'manufacturingCostTemplate',
  workOrder: 'workOrder',
  order: undefined,
  task: 'task',
  locationList: 'location',
  operationDisplayText: undefined,
  noteType: 'noteType',
  activity: undefined,
  author: undefined,
  folder: 'folder',
  media: undefined,
  record: 'record',
  recordType: undefined,
  topic: 'topic',
  winLossReason: 'winLossReason',
  competitor: undefined,
  roleList: 'role',
  merchantAccountsList: 'account',
  itemType: undefined,
  milestone: undefined,
  eventId: undefined,
  serviceItem: undefined,
  implementation: undefined,
  discount: undefined,
  freeShipMethod: undefined,
  purchaseContract: undefined,
  shipTo: undefined,
  intercoTransaction: undefined,
  linkedOrderList: undefined,
  landedCostCategory: undefined,
  recordRef: undefined,
  requestedby: undefined,
  allocationResource: undefined,
  allocationType: undefined,
  inventoryLocation: 'location',
  inventorySubsidiary: 'subsidiary',
  createdPo: undefined,
  poVendor: 'vendor',
  orderAllocationStrategy: undefined,
  purchaseAccount: 'account',
  saleAccount: 'account',
  nexusCountry: undefined,
  solution: 'solution',
  insertSolution: 'solution',
  profile: undefined,
  issue: 'issue',
  status: 'status',
  origin: undefined,
  escalatee: undefined,
  timeSheet: 'timeSheet',
  payablesAccount: 'account',
  purchaseOrderList: 'purchaseOrder',
  billreceiptsList: undefined,
  serialNumbersList: undefined,
  apAcct: 'account',
  manufacturingRouting: 'manufacturingRouting',
  assemblyItem: 'assemblyItem',
  startOperation: undefined,
  endOperation: undefined,
}

const getFieldType = (
  type: ObjectType,
  field: Field,
  typeMap: Record<string, TypeElement>,
): TypeElement | undefined => {
  if (field.name === PARENT) {
    return type
  }
  const typeName = fieldNameToTypeName[field.name]
  return typeName !== undefined ? typeMap[typeName] : undefined
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'replaceRecordRef',
  onFetch: async elements => {
    const recordRefElemId = new ElemID(NETSUITE, RECORD_REF)
    const recordRefListElemId = new ElemID(NETSUITE, 'recordRefList')

    const recordRefType = elements.filter(isObjectType).find(e => e.elemID.isEqual(recordRefElemId))
    if (recordRefType === undefined) {
      return
    }

    recordRefType.fields.id = new Field(recordRefType, 'id', BuiltinTypes.STRING)

    const types = elements.filter(isObjectType)
    const primitives = elements.filter(isPrimitiveType)
    const containers = elements.filter(isContainerType)
    const typeMap = _.keyBy([...types, ...primitives, ...containers], e => e.elemID.name)

    types.forEach(type => {
      type.fields = Object.fromEntries(
        Object.values(type.fields)
          .map(field => {
            const fieldType = field.getTypeSync()
            const fieldRealType = getFieldType(type, field, typeMap)
            const refFieldAnnotations = { ...field.annotations, isReference: true }
            if (fieldRealType !== undefined && fieldType.elemID.isEqual(recordRefElemId)) {
              return new Field(type, field.name, fieldRealType, refFieldAnnotations)
            }
            if (fieldType.elemID.isEqual(recordRefListElemId)) {
              return new Field(type, field.name, new ListType(fieldRealType ?? recordRefType), refFieldAnnotations)
            }
            return field
          })
          .map(field => [field.name, field]),
      )
    })
  },
})

export default filterCreator
