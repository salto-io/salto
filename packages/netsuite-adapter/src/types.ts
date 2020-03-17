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
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType, PrimitiveType, PrimitiveTypes,
  RESTRICTION_ANNOTATIONS, TypeElement,
} from '@salto-io/adapter-api'
import {
  ENTITY_CUSTOM_FIELD, EXTERNAL_ID, FAMILY_TYPE, INTERNAL_ID, IS_ATTRIBUTE, METADATA_TYPE,
  NETSUITE, RECORD_REF, SCRIPT_ID, TYPES_PATH, SUBTYPES_PATH,
} from './constants'

const entityCustomFieldElemID = new ElemID(NETSUITE, ENTITY_CUSTOM_FIELD)
const customFieldRoleAccessElemID = new ElemID(NETSUITE, 'CustomFieldRoleAccess')
const customFieldRoleAccessListElemID = new ElemID(NETSUITE, 'CustomFieldRoleAccessList')
const customizationAccessLevelElemID = new ElemID(NETSUITE, 'CustomizationAccessLevel')
const customizationSearchLevelElemID = new ElemID(NETSUITE, 'CustomizationSearchLevel')
export const recordRefElemID = new ElemID(NETSUITE, RECORD_REF)
const recordTypeElemID = new ElemID(NETSUITE, 'RecordType')

const typesFolderPath = [NETSUITE, TYPES_PATH]
const subtypesFolderPath = [NETSUITE, TYPES_PATH, SUBTYPES_PATH]

/**
 * All supported Netsuite types.
 * This is a static creation because Netsuite API supports only instances.
 */
export class Types {
  private static recordTypeSubType = new PrimitiveType({
    elemID: recordTypeElemID,
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
    path: [...subtypesFolderPath, recordTypeElemID.name],
  })

  private static recordRefSubType = new ObjectType({
    elemID: recordRefElemID,
    fields: {
      [INTERNAL_ID]: new Field(recordRefElemID, INTERNAL_ID, BuiltinTypes.SERVICE_ID, {
        [IS_ATTRIBUTE]: true,
      }),
      [EXTERNAL_ID]: new Field(recordRefElemID, EXTERNAL_ID, BuiltinTypes.SERVICE_ID, {
        [IS_ATTRIBUTE]: true,
      }),
      name: new Field(recordRefElemID, 'name', BuiltinTypes.STRING),
      type: new Field(recordRefElemID, 'type', Types.recordTypeSubType, { [IS_ATTRIBUTE]: true }),
    },
    path: [...subtypesFolderPath, recordRefElemID.name],
  })

  private static customizationAccessLevelSubType = new PrimitiveType({
    elemID: customizationAccessLevelElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        '_none',
        '_edit',
        '_view',
      ],
    },
    path: [...subtypesFolderPath, customizationAccessLevelElemID.name],
  })

  private static customizationSearchLevelSubType = new PrimitiveType({
    elemID: customizationSearchLevelElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        '_none',
        '_edit',
        '_run',
      ],
    },
    path: [...subtypesFolderPath, customizationSearchLevelElemID.name],
  })

  private static customFieldRoleAccessSubType = new ObjectType({
    elemID: customFieldRoleAccessElemID,
    fields: {
      role: new Field(customFieldRoleAccessElemID, 'role', Types.recordRefSubType),
      accessLevel: new Field(customFieldRoleAccessElemID, 'accessLevel',
        Types.customizationAccessLevelSubType),
      searchLevel: new Field(customFieldRoleAccessElemID, 'searchLevel',
        Types.customizationSearchLevelSubType),
    },
    path: [...subtypesFolderPath, customFieldRoleAccessElemID.name],
  })

  private static customFieldRoleAccessListSubType = new ObjectType({
    elemID: customFieldRoleAccessListElemID,
    fields: {
      roleAccess: new Field(customFieldRoleAccessListElemID, 'roleAccess',
        Types.customFieldRoleAccessSubType, {}, true),
    },
    path: [...subtypesFolderPath, customFieldRoleAccessListElemID.name],
  })

  public static customizationTypes: Record<string, ObjectType> = {
    [ENTITY_CUSTOM_FIELD]: new ObjectType({
      elemID: entityCustomFieldElemID,
      fields: {
        [INTERNAL_ID]: new Field(entityCustomFieldElemID, INTERNAL_ID, BuiltinTypes.SERVICE_ID, {
          [IS_ATTRIBUTE]: true,
        }),
        label: new Field(entityCustomFieldElemID, 'label', BuiltinTypes.STRING),
        owner: new Field(entityCustomFieldElemID, 'owner', Types.recordRefSubType),
        description: new Field(entityCustomFieldElemID, 'description', BuiltinTypes.STRING),
        [SCRIPT_ID]: new Field(entityCustomFieldElemID, SCRIPT_ID, BuiltinTypes.STRING),
        roleAccessList: new Field(entityCustomFieldElemID, 'roleAccessList',
          Types.customFieldRoleAccessListSubType),
      },
      annotationTypes: {
        [METADATA_TYPE]: BuiltinTypes.SERVICE_ID,
      },
      annotations: {
        [METADATA_TYPE]: 'entityCustomField',
      },
      path: [...typesFolderPath, entityCustomFieldElemID.name],
    }),
  }

  public static getFamilyTypeName(type: ObjectType): string {
    if (Types.customizationTypes[type.elemID.name].elemID.isEqual(type.elemID)) {
      return FAMILY_TYPE.CUSTOMIZATION
    }
    throw new Error(`Unsupported Type: ${type.elemID.name}`)
  }

  public static getTypesWithInstances(): ObjectType[] {
    return Object.values(Types.customizationTypes)
  }

  public static getAllTypes(): TypeElement[] {
    return [
      ...Object.values(Types.customizationTypes),
      Types.recordTypeSubType,
      Types.recordRefSubType,
      Types.customizationAccessLevelSubType,
      Types.customizationSearchLevelSubType,
      Types.customFieldRoleAccessSubType,
      Types.customFieldRoleAccessListSubType,
    ]
  }
}
