/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  CORE_ANNOTATIONS,
  Element,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  isInstanceElement,
  isObjectType,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import {
  addAliasToElements,
  AliasData as GenericAliasData,
  AliasComponent,
  ConstantComponent,
} from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { LocalFilterCreator } from '../filter'
import {
  APPLICATION_ID,
  BUNDLE,
  CUSTOM_RECORD_TYPE,
  FILE,
  FILE_CABINET_PATH_SEPARATOR,
  FOLDER,
  PATH,
  TRANSLATION_COLLECTION,
} from '../constants'
import { SuiteAppConfigTypeName, getElementValueOrAnnotations, isCustomRecordType, isFileCabinetType } from '../types'
import { ConfigurationTypeName } from '../types/configuration_types'
import { StandardType } from '../autogen/types'
import { SupportedDataType, isItemType } from '../data_elements/types'

const log = logger(module)
const { awu } = collections.asynciterable

const CUSTOM_RECORD_TYPES_WITH_SEGMENT = 'customrecordtypeswithsegment'
const CUSTOM_RECORD_INSTANCES = 'customrecordinstances'

const DEFAULT_TRANSLATION = 'defaulttranslation'

type ElementsMap = Parameters<typeof addAliasToElements>['0']['elementsMap']
type AliasDataWithSingleComponent = GenericAliasData<[AliasComponent]>
type AliasDataWithMultipleComponents = GenericAliasData<AliasComponent[]>
type ConstantAliasData = GenericAliasData<[ConstantComponent]>

const toAliasDataWithMultipleComponents = (...parts: string[]): AliasDataWithMultipleComponents => ({
  aliasComponents: parts.map(name => ({
    fieldName: name,
  })),
})

const toAliasDataWithSingleComponent = (fieldName: string): AliasDataWithSingleComponent => ({
  aliasComponents: [{ fieldName }],
})

const toConstantAliasData = (constant: string): ConstantAliasData => ({
  aliasComponents: [{ constant }],
})

const labelAlias = toAliasDataWithSingleComponent('label')
const titleAlias = toAliasDataWithSingleComponent('title')
const nameAlias = toAliasDataWithSingleComponent('name')
const recordNameAlias = toAliasDataWithSingleComponent('recordname')
const identifierAlias = toAliasDataWithSingleComponent('identifier')
const importNameAlias = toAliasDataWithSingleComponent('importname')
const fieldDefaultNameAlias = toAliasDataWithSingleComponent('FIELD_DEFAULT_NAME')
const fullNameAlias = toAliasDataWithMultipleComponents('firstName', 'lastName')
const accountNumberAlias = toAliasDataWithSingleComponent('accountNumber')
const fullNameAndAccountAlias = toAliasDataWithMultipleComponents('firstName', 'lastName', 'accountNumber')
const displayNameAlias = toAliasDataWithSingleComponent('displayName')
const itemIdAlias = toAliasDataWithSingleComponent('itemId')
const entityIdAlias = toAliasDataWithSingleComponent('entityId')
const periodNameAlias = toAliasDataWithSingleComponent('periodName')
const accountNameAlias = toAliasDataWithSingleComponent('acctName')
const applicationIdAlias = toAliasDataWithSingleComponent(APPLICATION_ID)

const CUSTOM_SEGMENT_FIELD = 'customsegment'
const customRecordTypesWithSegmentAlias: AliasDataWithSingleComponent = {
  aliasComponents: [
    {
      fieldName: CUSTOM_SEGMENT_FIELD,
      referenceFieldName: CORE_ANNOTATIONS.ALIAS,
    },
  ],
}

const standardInstancesAliasMap: Record<StandardType, AliasDataWithSingleComponent> = {
  addressForm: nameAlias,
  advancedpdftemplate: titleAlias,
  bankstatementparserplugin: nameAlias,
  bundleinstallationscript: nameAlias,
  center: labelAlias,
  centercategory: labelAlias,
  centerlink: labelAlias,
  centertab: labelAlias,
  clientscript: nameAlias,
  cmscontenttype: labelAlias,
  crmcustomfield: labelAlias,
  customglplugin: nameAlias,
  customlist: nameAlias,
  customrecordactionscript: nameAlias,
  customrecordtype: recordNameAlias,
  customsegment: labelAlias,
  customtransactiontype: nameAlias,
  dataset: nameAlias,
  datasetbuilderplugin: nameAlias,
  emailcaptureplugin: nameAlias,
  emailtemplate: nameAlias,
  entitycustomfield: labelAlias,
  entryForm: nameAlias,
  ficonnectivityplugin: nameAlias,
  financiallayout: nameAlias,
  fiparserplugin: nameAlias,
  integration: applicationIdAlias,
  itemcustomfield: labelAlias,
  itemnumbercustomfield: labelAlias,
  itemoptioncustomfield: labelAlias,
  kpiscorecard: nameAlias,
  mapreducescript: nameAlias,
  massupdatescript: nameAlias,
  othercustomfield: labelAlias,
  pluginimplementation: nameAlias,
  plugintype: nameAlias,
  portlet: nameAlias,
  promotionsplugin: nameAlias,
  publisheddashboard: nameAlias,
  reportdefinition: nameAlias,
  restlet: nameAlias,
  role: nameAlias,
  savedcsvimport: importNameAlias,
  savedsearch: fieldDefaultNameAlias,
  scheduledscript: nameAlias,
  sdfinstallationscript: nameAlias,
  secret: applicationIdAlias,
  sspapplication: nameAlias,
  sublist: labelAlias,
  subtab: titleAlias,
  suitelet: nameAlias,
  transactionForm: nameAlias,
  transactionbodycustomfield: labelAlias,
  transactioncolumncustomfield: labelAlias,
  translationcollection: nameAlias,
  usereventscript: nameAlias,
  workbook: nameAlias,
  workbookbuilderplugin: nameAlias,
  workflow: nameAlias,
  workflowactionscript: nameAlias,
}

export const standardTypesAliasMap: Record<StandardType, string> = {
  addressForm: 'Address Form',
  advancedpdftemplate: 'Advanced PDF Template',
  bankstatementparserplugin: 'Bank Statement Parser Plugin',
  bundleinstallationscript: 'Bundle Installation Script',
  center: 'Center',
  centercategory: 'Center Category',
  centerlink: 'Center Link',
  centertab: 'Center Tab',
  clientscript: 'Client Script',
  cmscontenttype: 'CMS Content Type',
  crmcustomfield: 'CRM Custom Field',
  customglplugin: 'Custom GL Plugin',
  customlist: 'Custom List',
  customrecordactionscript: 'Custom Record Action Script',
  customrecordtype: 'Custom Record Type',
  customsegment: 'Custom Segment',
  customtransactiontype: 'Custom Transaction Type',
  dataset: 'Dataset',
  datasetbuilderplugin: 'Dataset Builder Plugin',
  emailcaptureplugin: 'Email Capture Plugin',
  emailtemplate: 'Email Template',
  entitycustomfield: 'Entity Custom Field',
  entryForm: 'Entry Form',
  ficonnectivityplugin: 'Financial Institution Connectivity Plugin',
  financiallayout: 'Financial Layout',
  fiparserplugin: 'Financial Institution Parser Plugin',
  integration: 'Integration',
  itemcustomfield: 'Item Custom Field',
  itemnumbercustomfield: 'Item Number Custom Field',
  itemoptioncustomfield: 'Item Option Custom Field',
  kpiscorecard: 'KPI Score Card',
  mapreducescript: 'Map Reduce Script',
  massupdatescript: 'Mass Update Script',
  othercustomfield: 'Other Custom Field',
  pluginimplementation: 'Plugin Implementation',
  plugintype: 'Plugin Type',
  portlet: 'Portlet',
  promotionsplugin: 'Promotions Plugin',
  publisheddashboard: 'Published Dashboard',
  reportdefinition: 'Report Definition',
  restlet: 'Restlet',
  role: 'Role',
  savedcsvimport: 'Saved CSV Import',
  savedsearch: 'Saved Search',
  scheduledscript: 'Scheduled Script',
  sdfinstallationscript: 'SDF Installation Script',
  secret: 'Secret',
  sspapplication: 'SSP Application',
  sublist: 'Sublist',
  subtab: 'Subtab',
  suitelet: 'Suitelet',
  transactionForm: 'Transaction Form',
  transactionbodycustomfield: 'Transaction Body Custom Field',
  transactioncolumncustomfield: 'Transaction Column Custom Field',
  translationcollection: 'Translation Collection',
  usereventscript: 'User Event Script',
  workbook: 'Workbook',
  workbookbuilderplugin: 'Workbook Builder Plugin',
  workflow: 'Workflow',
  workflowactionscript: 'Workflow Action Script',
}

const dataInstancesAliasMap: Record<SupportedDataType, AliasDataWithMultipleComponents> = {
  subsidiary: nameAlias,
  department: nameAlias,
  classification: nameAlias,
  location: nameAlias,
  currency: nameAlias,
  customer: fullNameAndAccountAlias,
  employee: fullNameAndAccountAlias,
  job: accountNumberAlias,
  manufacturingCostTemplate: nameAlias,
  partner: fullNameAlias,
  solution: titleAlias,
  assemblyItem: displayNameAlias,
  lotNumberedAssemblyItem: displayNameAlias,
  serializedAssemblyItem: displayNameAlias,
  descriptionItem: itemIdAlias,
  discountItem: displayNameAlias,
  kitItem: displayNameAlias,
  markupItem: displayNameAlias,
  nonInventoryPurchaseItem: displayNameAlias,
  nonInventorySaleItem: displayNameAlias,
  nonInventoryResaleItem: displayNameAlias,
  otherChargeSaleItem: displayNameAlias,
  otherChargeResaleItem: displayNameAlias,
  otherChargePurchaseItem: displayNameAlias,
  paymentItem: displayNameAlias,
  serviceResaleItem: displayNameAlias,
  servicePurchaseItem: displayNameAlias,
  serviceSaleItem: displayNameAlias,
  subtotalItem: displayNameAlias,
  inventoryItem: displayNameAlias,
  lotNumberedInventoryItem: displayNameAlias,
  serializedInventoryItem: displayNameAlias,
  itemGroup: displayNameAlias,
  giftCertificateItem: displayNameAlias,
  downloadItem: displayNameAlias,
  accountingPeriod: periodNameAlias,
  account: accountNameAlias,
  nexus: identifierAlias,
  bin: identifierAlias,
}

export const dataTypesAliasMap: Record<SupportedDataType, string> = {
  subsidiary: 'Subsidiary',
  department: 'Department',
  classification: 'Classification',
  location: 'Location',
  currency: 'Currency',
  customer: 'Customer',
  employee: 'Employee',
  job: 'Job',
  manufacturingCostTemplate: 'Manufacturing Cost Template',
  partner: 'Partner',
  solution: 'Solution',
  assemblyItem: 'Assembly Item',
  lotNumberedAssemblyItem: 'Lot Numbered Assembly Item',
  serializedAssemblyItem: 'Serialized Assembly Item',
  descriptionItem: 'Description Item',
  discountItem: 'Discount Item',
  kitItem: 'Kit Item',
  markupItem: 'Markup Item',
  nonInventoryPurchaseItem: 'Non-inventory Purchase Item',
  nonInventorySaleItem: 'Non-inventory Sale Item',
  nonInventoryResaleItem: 'Non-inventory Resale Item',
  otherChargeSaleItem: 'Other Charge Sale Item',
  otherChargeResaleItem: 'Other Charge Resale Item',
  otherChargePurchaseItem: 'Other Charge Purchase Item',
  paymentItem: 'Payment Item',
  serviceResaleItem: 'Service Resale Item',
  servicePurchaseItem: 'Service Purchase Item',
  serviceSaleItem: 'Service Sale Item',
  subtotalItem: 'Subtotal Item',
  inventoryItem: 'Inventory Item',
  lotNumberedInventoryItem: 'Lot Numbered Inventory Item',
  serializedInventoryItem: 'Serialized Inventory Item',
  itemGroup: 'Item Group',
  giftCertificateItem: 'Gift Certificate Item',
  downloadItem: 'Download Item',
  accountingPeriod: 'Accounting Period',
  account: 'Account',
  nexus: 'Nexus',
  bin: 'Bin',
}

const [itemInstances, otherDataInstances] = _.partition(Object.keys(dataInstancesAliasMap), isItemType)
const entityIdFallbackAliasMap = Object.fromEntries(otherDataInstances.map(type => [type, entityIdAlias]))
const itemInstancesFallbackAliasMap = Object.fromEntries(itemInstances.map(type => [type, itemIdAlias]))

type SettingsTypeName = SuiteAppConfigTypeName | ConfigurationTypeName
export const settingsAliasMap: Record<SettingsTypeName, string> = {
  companyFeatures: 'Company Features',
  userPreferences: 'User Preferences',
  companyInformation: 'Company Information',
  companyPreferences: 'Company Preferences',
  accountingPreferences: 'Accounting Preferences',
}

const fileCabinetTypesAliasMap: Record<string, string> = {
  [FILE]: 'File',
  [FOLDER]: 'Folder',
}

const definitionTypesAliasMap = _.mapValues(
  {
    ...standardTypesAliasMap,
    ...dataTypesAliasMap,
    ...settingsAliasMap,
    ...fileCabinetTypesAliasMap,
  },
  toConstantAliasData,
)

const settingsInstancesAliasMap = _.mapValues(settingsAliasMap, toConstantAliasData)

const splitInstancesToGroups = async (
  instances: InstanceElement[],
): Promise<{
  fileCabinetInstances: InstanceElement[]
  customRecordInstances: InstanceElement[]
  otherInstances: InstanceElement[]
}> => {
  const fileCabinetInstances: InstanceElement[] = []
  const customRecordInstances: InstanceElement[] = []
  const otherInstances: InstanceElement[] = []
  await awu(instances).forEach(async instance => {
    if (isFileCabinetType(instance.refType)) {
      fileCabinetInstances.push(instance)
    } else if (isCustomRecordType(await instance.getType())) {
      customRecordInstances.push(instance)
    } else {
      otherInstances.push(instance)
    }
  })
  return {
    fileCabinetInstances,
    customRecordInstances,
    otherInstances,
  }
}

const splitTypesToGroups = (
  types: ObjectType[],
): {
  definitionTypes: ObjectType[]
  customRecordTypes: ObjectType[]
  customRecordTypesWithSegment: ObjectType[]
} => {
  const [customRecordTypes, definitionTypes] = _.partition(types, isCustomRecordType)
  const [customRecordTypesWithSegment, otherCustomRecordTypes] = _.partition(
    customRecordTypes,
    type => type.annotations[CUSTOM_SEGMENT_FIELD] !== undefined,
  )
  return {
    definitionTypes,
    customRecordTypes: otherCustomRecordTypes,
    customRecordTypesWithSegment,
  }
}

const addAliasToFileCabinetInstance = (instance: InstanceElement): void => {
  const path = instance.value[PATH]
  if (typeof path !== 'string') {
    log.warn('file cabinet instance %s has no string path field: %o', instance.elemID.getFullName(), path)
  } else {
    const basename = path.split(FILE_CABINET_PATH_SEPARATOR).slice(-1)[0]
    instance.annotations[CORE_ANNOTATIONS.ALIAS] = basename
  }
}

const addAliasFromTranslatedFields = async ({
  elementsSource,
  elementsMap,
  aliasMap,
}: {
  elementsSource: ReadOnlyElementsSource
  elementsMap: ElementsMap
  aliasMap: Record<string, AliasDataWithSingleComponent>
}): Promise<void> => {
  const relevantElementsMap = _.pick(elementsMap, Object.keys(aliasMap))
  await awu(Object.keys(relevantElementsMap)).forEach(async group => {
    const {
      aliasComponents: [{ fieldName }],
    } = aliasMap[group]

    await awu(relevantElementsMap[group]).forEach(async element => {
      const fieldValue = getElementValueOrAnnotations(element)[fieldName]
      if (!isReferenceExpression(fieldValue) || fieldValue.elemID.typeName !== TRANSLATION_COLLECTION) {
        log.warn(
          'cannot extract translated alias for element %s from field %s -' +
            ' field value is not a translation collection reference: %o',
          element.elemID.getFullName(),
          fieldName,
          fieldValue,
        )
        return
      }
      const defaultTranslationElemId = fieldValue.elemID.createParentID().createNestedID(DEFAULT_TRANSLATION)
      const { parent, path } = defaultTranslationElemId.createTopLevelParentID()
      const translationCollectionInstance = await elementsSource.get(parent)
      const alias = isInstanceElement(translationCollectionInstance)
        ? _.get(translationCollectionInstance.value, path)
        : undefined

      if (typeof alias !== 'string') {
        log.warn(
          'cannot extract translated alias for element %s from reference %s - reference value is not a string: %o',
          element.elemID.getFullName(),
          defaultTranslationElemId,
          alias,
        )
        return
      }

      element.annotations[CORE_ANNOTATIONS.ALIAS] = alias
    })
  })
}

const getElementsWithoutAlias = (elementsMap: ElementsMap): ElementsMap =>
  Object.fromEntries(
    Object.entries(elementsMap)
      .map(
        ([group, elems]) =>
          [group, elems.filter(element => element.annotations[CORE_ANNOTATIONS.ALIAS] === undefined)] as const,
      )
      .filter(([_group, elems]) => elems.length > 0),
  )

const filterCreator: LocalFilterCreator = ({ elementsSource, isPartial }) => ({
  name: 'addAlias',
  onFetch: async (elements: Element[]): Promise<void> => {
    const instances = elements.filter(isInstanceElement)
    const { fileCabinetInstances, customRecordInstances, otherInstances } = await splitInstancesToGroups(instances)

    const { definitionTypes, customRecordTypes, customRecordTypesWithSegment } = splitTypesToGroups(
      elements.filter(isObjectType),
    )

    addAliasToElements({
      elementsMap: _.groupBy(definitionTypes, type => type.elemID.name),
      aliasMap: definitionTypesAliasMap,
    })

    const otherInstancesMap = _.groupBy(otherInstances, instance => instance.elemID.typeName)
    const instancesMap: ElementsMap = {
      ...otherInstancesMap,
      [CUSTOM_RECORD_TYPE]: customRecordTypes,
      [CUSTOM_RECORD_INSTANCES]: customRecordInstances,
    }

    addAliasToElements({
      elementsMap: instancesMap,
      aliasMap: {
        ...standardInstancesAliasMap,
        ...dataInstancesAliasMap,
        ...settingsInstancesAliasMap,
        [BUNDLE]: nameAlias,
        [CUSTOM_RECORD_INSTANCES]: nameAlias,
      },
    })

    await addAliasFromTranslatedFields({
      elementsSource: buildElementsSourceFromElements(instances, isPartial ? [elementsSource] : []),
      elementsMap: getElementsWithoutAlias(instancesMap),
      aliasMap: standardInstancesAliasMap,
    })

    // some data type instances have a fallback
    addAliasToElements({
      elementsMap: getElementsWithoutAlias(instancesMap),
      aliasMap: {
        ...entityIdFallbackAliasMap,
        ...itemInstancesFallbackAliasMap,
      },
    })

    addAliasToElements({
      elementsMap: {
        ...instancesMap,
        [CUSTOM_RECORD_TYPES_WITH_SEGMENT]: customRecordTypesWithSegment,
      },
      aliasMap: {
        [CUSTOM_RECORD_TYPES_WITH_SEGMENT]: customRecordTypesWithSegmentAlias,
      },
    })

    fileCabinetInstances.forEach(addAliasToFileCabinetInstance)
  },
})

export default filterCreator
