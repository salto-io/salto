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
  RESTRICTION_ANNOTATIONS, TypeElement, ListType,
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
const customizationDisplayTypeElemID = new ElemID(NETSUITE, 'CustomizationDisplayType')
const customizationDynamicDefaultElemID = new ElemID(NETSUITE, 'CustomizationDynamicDefault')
const entityCustomFieldFilterListElemID = new ElemID(NETSUITE, 'EntityCustomFieldFilterList')
const entityCustomFieldFilterElemID = new ElemID(NETSUITE, 'EntityCustomFieldFilter')
const customizationFilterCompareTypeElemID = new ElemID(NETSUITE, 'CustomizationFilterCompareType')
const fldFilterSelListElemID = new ElemID(NETSUITE, 'FldFilterSelList')
const customFieldDepartmentAccessListElemID = new ElemID(NETSUITE, 'CustomFieldDepartmentAccessList')
const customFieldDepartmentAccessElemID = new ElemID(NETSUITE, 'CustomFieldDepartmentAccess')
const customFieldSubAccessListElemID = new ElemID(NETSUITE, 'CustomFieldSubAccessList')
const customFieldSubAccessSubTypeElemID = new ElemID(NETSUITE, 'CustomFieldSubAccess')
const customFieldTranslationsListElemID = new ElemID(NETSUITE, 'CustomFieldTranslationsList')
const customFieldTranslationsElemID = new ElemID(NETSUITE, 'CustomFieldTranslations')
const languageElemID = new ElemID(NETSUITE, 'Language')
const customizationFieldTypeElemID = new ElemID(NETSUITE, 'CustomizationFieldType')

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

  private static customizationDisplayTypeSubType = new PrimitiveType({
    elemID: customizationDisplayTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        '_disabled',
        '_hidden',
        '_inlineText',
        '_normal',
        '_showAsList',
      ],
    },
    path: [...subtypesFolderPath, customizationDisplayTypeElemID.name],
  })

  private static customizationDynamicDefaultSubType = new PrimitiveType({
    elemID: customizationDynamicDefaultElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        '_currentDateTime',
        '_currentUser',
        '_currentUsersDepartment',
        '_currentUsersLocation',
        '_currentUsersSupervisor',
        '_currentUsersSubsidiary',
      ],
    },
    path: [...subtypesFolderPath, customizationDynamicDefaultElemID.name],
  })

  private static customizationFilterCompareTypeSubType = new PrimitiveType({
    elemID: customizationFilterCompareTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        '_equal',
        '_greaterThan',
        '_greaterThanOrEqual',
        '_lessThan',
        '_lessThanOrEqual',
        '_notEqual',
      ],
    },
    path: [...subtypesFolderPath, customizationFilterCompareTypeElemID.name],
  })

  private static fldFilterSelListSubType = new ObjectType({
    elemID: fldFilterSelListElemID,
    fields: {
      fldFilterSel: new Field(fldFilterSelListElemID, 'fldFilterSel',
        new ListType(Types.recordRefSubType), {}),
    },
    path: [...subtypesFolderPath, fldFilterSelListElemID.name],
  })

  private static entityCustomFieldFilterSubType = new ObjectType({
    elemID: entityCustomFieldFilterElemID,
    fields: {
      fldFilter: new Field(entityCustomFieldFilterElemID, 'fldFilter', Types.recordRefSubType),
      fldFilterChecked: new Field(entityCustomFieldFilterElemID, 'fldFilterChecked',
        BuiltinTypes.BOOLEAN),
      fldFilterCompareType: new Field(entityCustomFieldFilterElemID, 'fldFilterCompareType',
        Types.customizationFilterCompareTypeSubType),
      fldFilterVal: new Field(entityCustomFieldFilterElemID, 'fldFilterVal', BuiltinTypes.STRING),
      fldFilterSelList: new Field(entityCustomFieldFilterElemID, 'fldFilterSelList',
        Types.fldFilterSelListSubType),
      fldFilterNotNull: new Field(entityCustomFieldFilterElemID, 'fldFilterNotNull',
        BuiltinTypes.BOOLEAN),
    },
    path: [...subtypesFolderPath, entityCustomFieldFilterElemID.name],
  })

  private static entityCustomFieldFilterListSubType = new ObjectType({
    elemID: entityCustomFieldFilterListElemID,
    fields: {
      filter: new Field(entityCustomFieldFilterListElemID, 'filter',
        new ListType(Types.entityCustomFieldFilterSubType), {}),
    },
    path: [...subtypesFolderPath, entityCustomFieldFilterListElemID.name],
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
        new ListType(Types.customFieldRoleAccessSubType), {}),
    },
    path: [...subtypesFolderPath, customFieldRoleAccessListElemID.name],
  })

  private static customFieldDepartmentAccessSubType = new ObjectType({
    elemID: customFieldDepartmentAccessElemID,
    fields: {
      dept: new Field(customFieldDepartmentAccessElemID, 'dept', Types.recordRefSubType),
      accessLevel: new Field(customFieldDepartmentAccessElemID, 'accessLevel',
        Types.customizationAccessLevelSubType),
      searchLevel: new Field(customFieldDepartmentAccessElemID, 'searchLevel',
        Types.customizationSearchLevelSubType),
    },
    path: [...subtypesFolderPath, customFieldDepartmentAccessElemID.name],
  })

  private static customFieldDepartmentAccessListSubType = new ObjectType({
    elemID: customFieldDepartmentAccessListElemID,
    fields: {
      deptAccess: new Field(customFieldDepartmentAccessListElemID, 'deptAccess',
        new ListType(Types.customFieldDepartmentAccessSubType), {}),
    },
    path: [...subtypesFolderPath, customFieldDepartmentAccessListElemID.name],
  })

  private static customFieldSubAccessSubType = new ObjectType({
    elemID: customFieldSubAccessSubTypeElemID,
    fields: {
      sub: new Field(customFieldSubAccessSubTypeElemID, 'sub', Types.recordRefSubType),
      accessLevel: new Field(customFieldSubAccessSubTypeElemID, 'accessLevel',
        Types.customizationAccessLevelSubType),
      searchLevel: new Field(customFieldSubAccessSubTypeElemID, 'searchLevel',
        Types.customizationSearchLevelSubType),
    },
    path: [...subtypesFolderPath, customFieldSubAccessSubTypeElemID.name],
  })

  private static customFieldSubAccessListSubType = new ObjectType({
    elemID: customFieldSubAccessListElemID,
    fields: {
      subAccess: new Field(customFieldSubAccessListElemID, 'subAccess',
        new ListType(Types.customFieldSubAccessSubType), {}),
    },
    path: [...subtypesFolderPath, customFieldSubAccessListElemID.name],
  })

  private static customizationFieldTypeSubType = new PrimitiveType({
    elemID: customizationFieldTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        '_checkBox',
        '_currency',
        '_date',
        '_datetime',
        '_decimalNumber',
        '_document',
        '_eMailAddress',
        '_freeFormText',
        '_help',
        '_hyperlink',
        '_image',
        '_inlineHTML',
        '_integerNumber',
        '_listRecord',
        '_longText',
        '_multipleSelect',
        '_password',
        '_percent',
        '_phoneNumber',
        '_richText',
        '_textArea',
        '_timeOfDay',
      ],
    },
    path: [...subtypesFolderPath, customizationFieldTypeElemID.name],
  })

  private static languageSubType = new PrimitiveType({
    elemID: languageElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        '_afrikaans',
        '_albanian',
        '_arabic',
        '_armenian',
        '_bengali',
        '_bosnian',
        '_bulgarian',
        '_catalan',
        '_chineseSimplified',
        '_chineseTraditional',
        '_croatian',
        '_czech',
        '_danish',
        '_dutch',
        '_englishAu',
        '_englishCa',
        '_englishInternational',
        '_englishUK',
        '_englishUS',
        '_estonian',
        '_filipino',
        '_finnish',
        '_frenchCanada',
        '_frenchFrance',
        '_german',
        '_greek',
        '_gujarati',
        '_haitian',
        '_hebrew',
        '_hindi',
        '_hungarian',
        '_icelandic',
        '_indonesian',
        '_italian',
        '_japanese',
        '_kannada',
        '_korean',
        '_latinAmericanSpanish',
        '_latvian',
        '_lithuanian',
        '_luxembourgish',
        '_malay',
        '_marathi',
        '_norwegian',
        '_persianIran',
        '_polish',
        '_portugueseBrazil',
        '_portuguesePortugal',
        '_punjabi',
        '_romanian',
        '_russian',
        '_serbianCyrillic',
        '_serbianLatin',
        '_slovak',
        '_slovenian',
        '_spanish',
        '_swedish',
        '_tamil',
        '_telugu',
        '_thai',
        '_turkish',
        '_ukrainian',
        '_vietnamese',
      ],
    },
    path: [...subtypesFolderPath, languageElemID.name],
  })

  private static customFieldTranslationsSubType = new ObjectType({
    elemID: customFieldTranslationsElemID,
    fields: {
      locale: new Field(customFieldTranslationsElemID, 'locale', Types.languageSubType),
      localeDescription: new Field(customFieldTranslationsElemID, 'localeDescription',
        BuiltinTypes.STRING),
      label: new Field(customFieldTranslationsElemID, 'label', BuiltinTypes.STRING),
      help: new Field(customFieldTranslationsElemID, 'help', BuiltinTypes.STRING),
    },
    path: [...subtypesFolderPath, customFieldTranslationsElemID.name],
  })

  private static customFieldTranslationsListSubType = new ObjectType({
    elemID: customFieldTranslationsListElemID,
    fields: {
      translations: new Field(customFieldTranslationsListElemID, 'translations',
        new ListType(Types.customFieldTranslationsSubType), {}),
    },
    path: [...subtypesFolderPath, customFieldTranslationsListElemID.name],
  })

  public static customizationTypes: Record<string, ObjectType> = {
    [ENTITY_CUSTOM_FIELD]: new ObjectType({
      elemID: entityCustomFieldElemID,
      fields: {
        [INTERNAL_ID]: new Field(entityCustomFieldElemID, INTERNAL_ID, BuiltinTypes.SERVICE_ID, {
          [IS_ATTRIBUTE]: true,
        }),
        fieldType: new Field(entityCustomFieldElemID, 'fieldType',
          Types.customizationFieldTypeSubType),
        [SCRIPT_ID]: new Field(entityCustomFieldElemID, SCRIPT_ID, BuiltinTypes.STRING),
        label: new Field(entityCustomFieldElemID, 'label', BuiltinTypes.STRING),
        owner: new Field(entityCustomFieldElemID, 'owner', Types.recordRefSubType),
        description: new Field(entityCustomFieldElemID, 'description', BuiltinTypes.STRING),
        selectRecordType: new Field(entityCustomFieldElemID, 'selectRecordType',
          Types.recordRefSubType),
        storeValue: new Field(entityCustomFieldElemID, 'storeValue', BuiltinTypes.BOOLEAN),
        showInList: new Field(entityCustomFieldElemID, 'showInList', BuiltinTypes.BOOLEAN),
        globalSearch: new Field(entityCustomFieldElemID, 'globalSearch', BuiltinTypes.BOOLEAN),
        isParent: new Field(entityCustomFieldElemID, 'isParent', BuiltinTypes.BOOLEAN),
        insertBefore: new Field(entityCustomFieldElemID, 'insertBefore', Types.recordRefSubType),
        availableToSso: new Field(entityCustomFieldElemID, 'availableToSso', BuiltinTypes.BOOLEAN),
        subtab: new Field(entityCustomFieldElemID, 'subtab', Types.recordRefSubType),
        displayType: new Field(entityCustomFieldElemID, 'displayType',
          Types.customizationDisplayTypeSubType),
        displayWidth: new Field(entityCustomFieldElemID, 'displayWidth', BuiltinTypes.NUMBER),
        displayHeight: new Field(entityCustomFieldElemID, 'displayHeight', BuiltinTypes.NUMBER),
        help: new Field(entityCustomFieldElemID, 'help', BuiltinTypes.STRING),
        parentSubtab: new Field(entityCustomFieldElemID, 'parentSubtab', Types.recordRefSubType),
        linkText: new Field(entityCustomFieldElemID, 'linkText', BuiltinTypes.STRING),
        isMandatory: new Field(entityCustomFieldElemID, 'isMandatory', BuiltinTypes.BOOLEAN),
        checkSpelling: new Field(entityCustomFieldElemID, 'checkSpelling', BuiltinTypes.BOOLEAN),
        maxLength: new Field(entityCustomFieldElemID, 'maxLength', BuiltinTypes.NUMBER),
        minValue: new Field(entityCustomFieldElemID, 'minValue', BuiltinTypes.NUMBER),
        maxValue: new Field(entityCustomFieldElemID, 'maxValue', BuiltinTypes.NUMBER),
        defaultChecked: new Field(entityCustomFieldElemID, 'defaultChecked', BuiltinTypes.BOOLEAN),
        defaultValue: new Field(entityCustomFieldElemID, 'defaultValue', BuiltinTypes.STRING),
        isFormula: new Field(entityCustomFieldElemID, 'isFormula', BuiltinTypes.BOOLEAN),
        defaultSelection: new Field(entityCustomFieldElemID, 'defaultSelection',
          Types.recordRefSubType),
        dynamicDefault: new Field(entityCustomFieldElemID, 'dynamicDefault',
          Types.customizationDynamicDefaultSubType),
        searchDefault: new Field(entityCustomFieldElemID, 'searchDefault', Types.recordRefSubType),
        searchCompareField: new Field(entityCustomFieldElemID, 'searchCompareField',
          Types.recordRefSubType),
        sourceList: new Field(entityCustomFieldElemID, 'sourceList', Types.recordRefSubType),
        sourceFrom: new Field(entityCustomFieldElemID, 'sourceFrom', Types.recordRefSubType),
        sourcefilterby: new Field(entityCustomFieldElemID, 'sourcefilterby',
          Types.recordRefSubType),
        customSegment: new Field(entityCustomFieldElemID, 'customSegment', Types.recordRefSubType),
        appliesToCustomer: new Field(entityCustomFieldElemID, 'appliesToCustomer', BuiltinTypes.BOOLEAN),
        appliesToProject: new Field(entityCustomFieldElemID, 'appliesToProject', BuiltinTypes.BOOLEAN),
        appliesToVendor: new Field(entityCustomFieldElemID, 'appliesToVendor', BuiltinTypes.BOOLEAN),
        appliesToEmployee: new Field(entityCustomFieldElemID, 'appliesToEmployee', BuiltinTypes.BOOLEAN),
        appliesToOtherName: new Field(entityCustomFieldElemID, 'appliesToOtherName', BuiltinTypes.BOOLEAN),
        appliesToContact: new Field(entityCustomFieldElemID, 'appliesToContact', BuiltinTypes.BOOLEAN),
        appliesToPartner: new Field(entityCustomFieldElemID, 'appliesToPartner', BuiltinTypes.BOOLEAN),
        appliesToWebSite: new Field(entityCustomFieldElemID, 'appliesToWebSite', BuiltinTypes.BOOLEAN),
        appliesToGroup: new Field(entityCustomFieldElemID, 'appliesToGroup', BuiltinTypes.BOOLEAN),
        availableExternally: new Field(entityCustomFieldElemID, 'availableExternally', BuiltinTypes.BOOLEAN),
        filterList: new Field(entityCustomFieldElemID, 'filterList',
          Types.entityCustomFieldFilterListSubType),
        accessLevel: new Field(entityCustomFieldElemID, 'accessLevel',
          Types.customizationAccessLevelSubType),
        appliesToStatement: new Field(entityCustomFieldElemID, 'appliesToStatement',
          BuiltinTypes.BOOLEAN),
        searchLevel: new Field(entityCustomFieldElemID, 'searchLevel',
          Types.customizationSearchLevelSubType),
        appliesToPriceList: new Field(entityCustomFieldElemID, 'appliesToPriceList',
          BuiltinTypes.BOOLEAN),
        roleAccessList: new Field(entityCustomFieldElemID, 'roleAccessList',
          Types.customFieldRoleAccessListSubType),
        deptAccessList: new Field(entityCustomFieldElemID, 'deptAccessList',
          Types.customFieldDepartmentAccessListSubType),
        subAccessList: new Field(entityCustomFieldElemID, 'subAccessList',
          Types.customFieldSubAccessListSubType),
        translationsList: new Field(entityCustomFieldElemID, 'translationsList',
          Types.customFieldTranslationsListSubType),
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
      Types.customizationDisplayTypeSubType,
      Types.customizationDynamicDefaultSubType,
      Types.entityCustomFieldFilterListSubType,
      Types.entityCustomFieldFilterSubType,
      Types.fldFilterSelListSubType,
      Types.customizationFilterCompareTypeSubType,
      Types.customFieldDepartmentAccessListSubType,
      Types.customFieldDepartmentAccessSubType,
      Types.customFieldSubAccessListSubType,
      Types.customFieldSubAccessSubType,
      Types.customFieldTranslationsListSubType,
      Types.customFieldTranslationsSubType,
      Types.languageSubType,
      Types.customizationFieldTypeSubType,
    ]
  }
}
