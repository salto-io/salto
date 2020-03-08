/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  bpCase,
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ObjectType,
  PrimitiveType, PrimitiveTypes, RESTRICTION_ANNOTATIONS, transformValues, Values,
} from '@salto-io/adapter-api'
import {
  ATTRIBUTES,
  EXTERNAL_ID, INTERNAL_ID, METADATA_TYPE, NETSUITE, RECORDS_PATH,
} from './constants'

const entityCustomFieldElemID = new ElemID(NETSUITE, 'EntityCustomField')
const recordRefElemID = new ElemID(NETSUITE, 'RecordRef')

/**
 * All supported Netsuite types.
 * This is a static creation because Netsuite API supports only instances.
 */
export class Types {
  private static platformCoreSubtypes: Record<string, PrimitiveType> = {
    RecordType: new PrimitiveType({
      elemID: new ElemID(NETSUITE, 'RecordType'),
      primitive: PrimitiveTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
        [CORE_ANNOTATIONS.VALUES]: [
          'account',
          'accountingPeriod',
          'advInterCompanyJournalEntry',
          'assemblyBuild',
          'assemblyUnbuild',
          'assemblyItem',
          'billingAccount',
          'billingSchedule',
          'bin',
          'binTransfer',
          'binWorksheet',
          'bom',
          'bomRevision',
          'budget',
          'budgetCategory',
          'calendarEvent',
          'campaign',
          'campaignAudience',
          'campaignCategory',
          'campaignChannel',
          'campaignFamily',
          'campaignOffer',
          'campaignResponse',
          'campaignSearchEngine',
          'campaignSubscription',
          'campaignVertical',
          'cashRefund',
          'cashSale',
          'check',
          'charge',
          'classification',
          'consolidatedExchangeRate',
          'contact',
          'contactCategory',
          'contactRole',
          'costCategory',
          'couponCode',
          'creditMemo',
          'crmCustomField',
          'currency',
          'currencyRate',
          'customList',
          'customPurchase',
          'customRecord',
          'customRecordCustomField',
          'customRecordType',
          'customSale',
          'customSegment',
          'customTransaction',
          'customTransactionType',
          'customer',
          'customerCategory',
          'customerDeposit',
          'customerMessage',
          'customerPayment',
          'customerRefund',
          'customerStatus',
          'customerSubsidiaryRelationship',
          'deposit',
          'depositApplication',
          'department',
          'descriptionItem',
          'discountItem',
          'downloadItem',
          'employee',
          'entityCustomField',
          'entityGroup',
          'estimate',
          'expenseCategory',
          'expenseReport',
          'fairValuePrice',
          'file',
          'folder',
          'generalToken',
          'giftCertificate',
          'giftCertificateItem',
          'globalAccountMapping',
          'hcmJob',
          'inboundShipment',
          'interCompanyJournalEntry',
          'interCompanyTransferOrder',
          'inventoryAdjustment',
          'inventoryCostRevaluation',
          'inventoryItem',
          'inventoryNumber',
          'inventoryTransfer',
          'invoice',
          'itemAccountMapping',
          'itemCustomField',
          'itemDemandPlan',
          'itemFulfillment',
          'itemGroup',
          'itemNumberCustomField',
          'itemOptionCustomField',
          'itemSupplyPlan',
          'itemRevision',
          'issue',
          'job',
          'jobStatus',
          'jobType',
          'itemReceipt',
          'journalEntry',
          'kitItem',
          'leadSource',
          'location',
          'lotNumberedInventoryItem',
          'lotNumberedAssemblyItem',
          'markupItem',
          'merchandiseHierarchyNode',
          'message',
          'manufacturingCostTemplate',
          'manufacturingOperationTask',
          'manufacturingRouting',
          'nexus',
          'nonInventoryPurchaseItem',
          'nonInventoryResaleItem',
          'nonInventorySaleItem',
          'note',
          'noteType',
          'opportunity',
          'otherChargePurchaseItem',
          'otherChargeResaleItem',
          'otherChargeSaleItem',
          'otherCustomField',
          'otherNameCategory',
          'partner',
          'partnerCategory',
          'paycheck',
          'paycheckJournal',
          'paymentCard',
          'paymentCardToken',
          'paymentItem',
          'paymentMethod',
          'payrollItem',
          'periodEndJournal',
          'phoneCall',
          'priceLevel',
          'pricingGroup',
          'projectTask',
          'promotionCode',
          'purchaseOrder',
          'purchaseRequisition',
          'resourceAllocation',
          'returnAuthorization',
          'revRecSchedule',
          'revRecTemplate',
          'salesOrder',
          'salesRole',
          'salesTaxItem',
          'serializedInventoryItem',
          'serializedAssemblyItem',
          'servicePurchaseItem',
          'serviceResaleItem',
          'serviceSaleItem',
          'solution',
          'siteCategory',
          'state',
          'statisticalJournalEntry',
          'subsidiary',
          'subtotalItem',
          'supportCase',
          'supportCaseIssue',
          'supportCaseOrigin',
          'supportCasePriority',
          'supportCaseStatus',
          'supportCaseType',
          'task',
          'taxAcct',
          'taxGroup',
          'taxType',
          'term',
          'timeBill',
          'timeSheet',
          'topic',
          'transferOrder',
          'transactionBodyCustomField',
          'transactionColumnCustomField',
          'unitsType',
          'usage',
          'vendor',
          'vendorCategory',
          'vendorBill',
          'vendorCredit',
          'vendorPayment',
          'vendorReturnAuthorization',
          'vendorSubsidiaryRelationship',
          'winLossReason',
          'workOrder',
          'workOrderIssue',
          'workOrderCompletion',
          'workOrderClose',
        ],
      },
    }),
  }

  private static platformCoreObjects: Record<string, ObjectType> = {
    RecordRef: new ObjectType({
      elemID: recordRefElemID,
      fields: {
        [INTERNAL_ID]: new Field(recordRefElemID, INTERNAL_ID, BuiltinTypes.SERVICE_ID),
        [EXTERNAL_ID]: new Field(recordRefElemID, EXTERNAL_ID, BuiltinTypes.SERVICE_ID),
        name: new Field(recordRefElemID, 'name', BuiltinTypes.STRING),
        type: new Field(recordRefElemID, 'type', Types.platformCoreSubtypes.RecordType),
      },
    }),
  }

  public static customizationObjects: Record<string, ObjectType> = {
    EntityCustomField: new ObjectType({
      elemID: entityCustomFieldElemID,
      fields: {
        [INTERNAL_ID]: new Field(entityCustomFieldElemID, INTERNAL_ID, BuiltinTypes.SERVICE_ID),
        label: new Field(entityCustomFieldElemID, 'label', BuiltinTypes.STRING),
        owner: new Field(entityCustomFieldElemID, 'owner', Types.platformCoreObjects.RecordRef),
        description: new Field(entityCustomFieldElemID, 'description', BuiltinTypes.STRING),
      },
      annotationTypes: {
        [METADATA_TYPE]: BuiltinTypes.SERVICE_ID,
      },
      annotations: {
        [METADATA_TYPE]: 'entityCustomField',
      },
    }),
  }
}

const fromNetsuiteRecord = (record: Values, type: ObjectType): Values => {
  // Netsuite Records are returned with ATTRIBUTES object that we should embed into its parent
  // { "$attributes": { "internalId": "1" }, "label": "A" } => { "internalId": "1" , "label": "A" }
  const flattenAttributes = (values: Values): Values => {
    const flattenAttributesCustomizer = (val: Values): Values | undefined => {
      if (_.has(val, ATTRIBUTES)) {
        const withInnerAttributes = _.merge({}, val, val[ATTRIBUTES])
        const withFlattenAttributes = _.omit(withInnerAttributes, ATTRIBUTES)
        return _.cloneDeepWith(withFlattenAttributes, flattenAttributesCustomizer)
      }
      return undefined
    }
    return _.cloneDeepWith(values, flattenAttributesCustomizer)
  }
  return transformValues({ values: flattenAttributes(record), type }) || {}
}

export const createInstanceElement = (record: Values, type: ObjectType): InstanceElement => {
  const values = fromNetsuiteRecord(record, type)
  const instanceName = bpCase(values.label)
  return new InstanceElement(instanceName, type, values,
    [NETSUITE, RECORDS_PATH, type.elemID.name, instanceName])
}
