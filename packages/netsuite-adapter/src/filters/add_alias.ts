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
  IS_SUB_INSTANCE,
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

const standardTypesAliasMap: Record<StandardType, ConstantAliasData> = {
  addressForm: toConstantAliasData('Address Form'),
  advancedpdftemplate: toConstantAliasData('Advanced PDF Template'),
  bankstatementparserplugin: toConstantAliasData('Bank Statement Parser Plugin'),
  bundleinstallationscript: toConstantAliasData('Bundle Installation Script'),
  center: toConstantAliasData('Center'),
  centercategory: toConstantAliasData('Center Category'),
  centerlink: toConstantAliasData('Center Link'),
  centertab: toConstantAliasData('Center Tab'),
  clientscript: toConstantAliasData('Client Script'),
  cmscontenttype: toConstantAliasData('CMS Content Type'),
  crmcustomfield: toConstantAliasData('CRM Custom Field'),
  customglplugin: toConstantAliasData('Custom GL Plugin'),
  customlist: toConstantAliasData('Custom List'),
  customrecordactionscript: toConstantAliasData('Custom Record Action Script'),
  customrecordtype: toConstantAliasData('Custom Record Type'),
  customsegment: toConstantAliasData('Custom Segment'),
  customtransactiontype: toConstantAliasData('Custom Transaction Type'),
  dataset: toConstantAliasData('Dataset'),
  datasetbuilderplugin: toConstantAliasData('Dataset Builder Plugin'),
  emailcaptureplugin: toConstantAliasData('Email Capture Plugin'),
  emailtemplate: toConstantAliasData('Email Template'),
  entitycustomfield: toConstantAliasData('Entity Custom Field'),
  entryForm: toConstantAliasData('Entry Form'),
  ficonnectivityplugin: toConstantAliasData('Financial Institution Connectivity Plugin'),
  financiallayout: toConstantAliasData('Financial Layout'),
  fiparserplugin: toConstantAliasData('Financial Institution Parser Plugin'),
  integration: toConstantAliasData('Integration'),
  itemcustomfield: toConstantAliasData('Item Custom Field'),
  itemnumbercustomfield: toConstantAliasData('Item Number Custom Field'),
  itemoptioncustomfield: toConstantAliasData('Item Option Custom Field'),
  kpiscorecard: toConstantAliasData('KPI Score Card'),
  mapreducescript: toConstantAliasData('Map Reduce Script'),
  massupdatescript: toConstantAliasData('Mass Update Script'),
  othercustomfield: toConstantAliasData('Other Custom Field'),
  pluginimplementation: toConstantAliasData('Plugin Implementation'),
  plugintype: toConstantAliasData('Plugin Type'),
  portlet: toConstantAliasData('Portlet'),
  promotionsplugin: toConstantAliasData('Promotions Plugin'),
  publisheddashboard: toConstantAliasData('Published Dashboard'),
  reportdefinition: toConstantAliasData('Report Definition'),
  restlet: toConstantAliasData('Restlet'),
  role: toConstantAliasData('Role'),
  savedcsvimport: toConstantAliasData('Saved CSV Import'),
  savedsearch: toConstantAliasData('Saved Search'),
  scheduledscript: toConstantAliasData('Scheduled Script'),
  sdfinstallationscript: toConstantAliasData('SDF Installation Script'),
  secret: toConstantAliasData('Secret'),
  sspapplication: toConstantAliasData('SSP Application'),
  sublist: toConstantAliasData('Sublist'),
  subtab: toConstantAliasData('Subtab'),
  suitelet: toConstantAliasData('Suitelet'),
  transactionForm: toConstantAliasData('Transaction Form'),
  transactionbodycustomfield: toConstantAliasData('Transaction Body Custom Field'),
  transactioncolumncustomfield: toConstantAliasData('Transaction Column Custom Field'),
  translationcollection: toConstantAliasData('Translation Collection'),
  usereventscript: toConstantAliasData('User Event Script'),
  workbook: toConstantAliasData('Workbook'),
  workbookbuilderplugin: toConstantAliasData('Workbook Builder Plugin'),
  workflow: toConstantAliasData('Workflow'),
  workflowactionscript: toConstantAliasData('Workflow Action Script'),
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

const dataTypesAliasMap: Record<SupportedDataType, ConstantAliasData> = {
  subsidiary: toConstantAliasData('Subsidiary'),
  department: toConstantAliasData('Department'),
  classification: toConstantAliasData('Classification'),
  location: toConstantAliasData('Location'),
  currency: toConstantAliasData('Currency'),
  customer: toConstantAliasData('Customer'),
  employee: toConstantAliasData('Employee'),
  job: toConstantAliasData('Job'),
  manufacturingCostTemplate: toConstantAliasData('Manufacturing Cost Template'),
  partner: toConstantAliasData('Partner'),
  solution: toConstantAliasData('Solution'),
  assemblyItem: toConstantAliasData('Assembly Item'),
  lotNumberedAssemblyItem: toConstantAliasData('Lot Numbered Assembly Item'),
  serializedAssemblyItem: toConstantAliasData('Serialized Assembly Item'),
  descriptionItem: toConstantAliasData('Description Item'),
  discountItem: toConstantAliasData('Discount Item'),
  kitItem: toConstantAliasData('Kit Item'),
  markupItem: toConstantAliasData('Markup Item'),
  nonInventoryPurchaseItem: toConstantAliasData('Non-inventory Purchase Item'),
  nonInventorySaleItem: toConstantAliasData('Non-inventory Sale Item'),
  nonInventoryResaleItem: toConstantAliasData('Non-inventory Resale Item'),
  otherChargeSaleItem: toConstantAliasData('Other Charge Sale Item'),
  otherChargeResaleItem: toConstantAliasData('Other Charge Resale Item'),
  otherChargePurchaseItem: toConstantAliasData('Other Charge Purchase Item'),
  paymentItem: toConstantAliasData('Payment Item'),
  serviceResaleItem: toConstantAliasData('Service Resale Item'),
  servicePurchaseItem: toConstantAliasData('Service Purchase Item'),
  serviceSaleItem: toConstantAliasData('Service Sale Item'),
  subtotalItem: toConstantAliasData('Subtotal Item'),
  inventoryItem: toConstantAliasData('Inventory Item'),
  lotNumberedInventoryItem: toConstantAliasData('Lot Numbered Inventory Item'),
  serializedInventoryItem: toConstantAliasData('Serialized Inventory Item'),
  itemGroup: toConstantAliasData('Item Group'),
  giftCertificateItem: toConstantAliasData('Gift Certificate Item'),
  downloadItem: toConstantAliasData('Download Item'),
  accountingPeriod: toConstantAliasData('Accounting Period'),
  account: toConstantAliasData('Account'),
  nexus: toConstantAliasData('Nexus'),
  bin: toConstantAliasData('Bin'),
}

const [itemInstances, otherDataInstances] = _.partition(Object.keys(dataInstancesAliasMap), isItemType)
const entityIdFallbackAliasMap = Object.fromEntries(otherDataInstances.map(type => [type, entityIdAlias]))
const itemInstancesFallbackAliasMap = Object.fromEntries(itemInstances.map(type => [type, itemIdAlias]))

type SettingsTypeName = SuiteAppConfigTypeName | ConfigurationTypeName
const settingsAliasMap: Record<SettingsTypeName, ConstantAliasData> = {
  companyFeatures: toConstantAliasData('Company Features'),
  userPreferences: toConstantAliasData('User Preferences'),
  companyInformation: toConstantAliasData('Company Information'),
  companyPreferences: toConstantAliasData('Company Preferences'),
  accountingPreferences: toConstantAliasData('Accounting Preferences'),
}

const fileCabinetTypesAliasMap: Record<string, ConstantAliasData> = {
  [FILE]: toConstantAliasData('File'),
  [FOLDER]: toConstantAliasData('Folder'),
}

const splitInstancesToGroups = async (
  instances: InstanceElement[],
): Promise<{
  fileCabinetInstances: InstanceElement[]
  customRecordInstances: InstanceElement[]
  subInstances: InstanceElement[]
  otherInstances: InstanceElement[]
}> => {
  const fileCabinetInstances: InstanceElement[] = []
  const customRecordInstances: InstanceElement[] = []
  const subInstances: InstanceElement[] = []
  const otherInstances: InstanceElement[] = []
  await awu(instances).forEach(async instance => {
    if (isFileCabinetType(instance.refType)) {
      fileCabinetInstances.push(instance)
    } else if (isCustomRecordType(await instance.getType())) {
      customRecordInstances.push(instance)
    } else if (instance.value[IS_SUB_INSTANCE]) {
      subInstances.push(instance)
    } else {
      otherInstances.push(instance)
    }
  })
  return {
    fileCabinetInstances,
    customRecordInstances,
    subInstances,
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

const filterCreator: LocalFilterCreator = ({ config, elementsSource, isPartial }) => ({
  name: 'addAlias',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (config.fetch.addAlias === false) {
      log.info('not running addAlias filter as addAlias in the config is false')
      return
    }

    const instances = elements.filter(isInstanceElement)
    const { fileCabinetInstances, customRecordInstances, subInstances, otherInstances } =
      await splitInstancesToGroups(instances)

    const { definitionTypes, customRecordTypes, customRecordTypesWithSegment } = splitTypesToGroups(
      elements.filter(isObjectType),
    )

    addAliasToElements({
      elementsMap: _.groupBy(definitionTypes, type => type.elemID.name),
      aliasMap: {
        ...standardTypesAliasMap,
        ...dataTypesAliasMap,
        ...settingsAliasMap,
        ...fileCabinetTypesAliasMap,
      },
    })

    const otherInstancesMap = _.groupBy(otherInstances, instance => instance.elemID.typeName)
    const instancesMap: ElementsMap = {
      ...otherInstancesMap,
      [IS_SUB_INSTANCE]: subInstances,
      [CUSTOM_RECORD_TYPE]: customRecordTypes,
      [CUSTOM_RECORD_INSTANCES]: customRecordInstances,
    }

    addAliasToElements({
      elementsMap: instancesMap,
      aliasMap: {
        ...standardInstancesAliasMap,
        ...dataInstancesAliasMap,
        ...settingsAliasMap,
        [BUNDLE]: nameAlias,
        [IS_SUB_INSTANCE]: nameAlias,
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
        [IS_SUB_INSTANCE]: labelAlias,
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
