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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ObjectType,
  PrimitiveType, PrimitiveTypes, RESTRICTION_ANNOTATIONS, Values,
} from '@salto-io/adapter-api'
import { Record } from 'node-suitetalk'
import {
  bpCase, transformValues,
} from '@salto-io/adapter-utils'
import {
  ATTRIBUTES, ENTITY_CUSTOM_FIELD, EXTERNAL_ID, FAMILY_TYPE, INTERNAL_ID, IS_ATTRIBUTE,
  METADATA_TYPE, NETSUITE, RECORDS_PATH, RECORD_REF, SCRIPT_ID,
} from './constants'
import { NetsuiteRecord, NetsuiteReference } from './client/client'

const entityCustomFieldElemID = new ElemID(NETSUITE, ENTITY_CUSTOM_FIELD)
const recordRefElemID = new ElemID(NETSUITE, RECORD_REF)

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
    [RECORD_REF]: new ObjectType({
      elemID: recordRefElemID,
      fields: {
        [INTERNAL_ID]: new Field(recordRefElemID, INTERNAL_ID, BuiltinTypes.SERVICE_ID, {
          [IS_ATTRIBUTE]: true,
        }),
        [EXTERNAL_ID]: new Field(recordRefElemID, EXTERNAL_ID, BuiltinTypes.SERVICE_ID, {
          [IS_ATTRIBUTE]: true,
        }),
        name: new Field(recordRefElemID, 'name', BuiltinTypes.STRING),
        type: new Field(recordRefElemID, 'type', Types.platformCoreSubtypes.RecordType, {
          [IS_ATTRIBUTE]: true,
        }),
      },
    }),
  }

  public static customizationObjects: Record<string, ObjectType> = {
    [ENTITY_CUSTOM_FIELD]: new ObjectType({
      elemID: entityCustomFieldElemID,
      fields: {
        [INTERNAL_ID]: new Field(entityCustomFieldElemID, INTERNAL_ID, BuiltinTypes.SERVICE_ID, {
          [IS_ATTRIBUTE]: true,
        }),
        label: new Field(entityCustomFieldElemID, 'label', BuiltinTypes.STRING),
        owner: new Field(entityCustomFieldElemID, 'owner', Types.platformCoreObjects[RECORD_REF]),
        description: new Field(entityCustomFieldElemID, 'description', BuiltinTypes.STRING),
        [SCRIPT_ID]: new Field(entityCustomFieldElemID, SCRIPT_ID, BuiltinTypes.STRING),
      },
      annotationTypes: {
        [METADATA_TYPE]: BuiltinTypes.SERVICE_ID,
      },
      annotations: {
        [METADATA_TYPE]: 'entityCustomField',
      },
    }),
  }

  public static getFamilyTypeName(type: ObjectType): string {
    if (Types.customizationObjects[type.elemID.name].elemID.isEqual(type.elemID)) {
      return FAMILY_TYPE.CUSTOMIZATION
    }
    throw new Error(`Unsupported Type: ${type.elemID.name}`)
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

export const internalId = (instance: InstanceElement): string =>
  instance.value[INTERNAL_ID]

const metadataType = (instance: InstanceElement): string =>
  instance.type.annotations[METADATA_TYPE]

const isAttribute = (field: Field): boolean =>
  field.annotations[IS_ATTRIBUTE] === true

const toNetsuiteFields = (instance: InstanceElement): Record.Fields.Field[] =>
  Object.entries(instance.value)
    .filter(([name, _value]) => !isAttribute(instance.type.fields[name]))
    .map(([name, value]) => {
      const fieldType = instance.type.fields[name].type
      if (fieldType.elemID.isEqual(recordRefElemID)) {
        const field = new Record.Fields.RecordRef(name)
        _.assign(field, value)
        return field
      }
      return new Record.Fields.Field(name, value)
    })

const setAttributes = (record: NetsuiteRecord, instance: InstanceElement): void => {
  _.assign(record,
    _.pickBy(instance.value, (_value, name) => isAttribute(instance.type.fields[name])))
}

export const toNetsuiteRecord = (instance: InstanceElement): NetsuiteRecord => {
  const record = new Record.Types.Record(Types.getFamilyTypeName(instance.type),
    instance.type.elemID.name)
  setAttributes(record, instance)
  record.bodyFieldList = toNetsuiteFields(instance)
  return record
}

export const toNetsuiteReference = (instance: InstanceElement): NetsuiteReference =>
  new Record.Types.Reference(RECORD_REF, metadataType(instance), internalId(instance))
