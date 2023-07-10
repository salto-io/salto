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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { CORE_ANNOTATIONS, Element, InstanceElement, ReadOnlyElementsSource, isInstanceElement, isObjectType, isReferenceExpression } from '@salto-io/adapter-api'
import { addAliasToElements, AliasData as GenericAliasData, AliasComponent } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { LocalFilterCreator } from '../filter'
import { APPLICATION_ID, CUSTOM_RECORD_TYPE, FILE_CABINET_PATH_SEPARATOR, IS_SUB_INSTANCE, PATH, TRANSLATION_COLLECTION } from '../constants'
import { getElementValueOrAnnotations, isCustomRecordType, isFileCabinetType } from '../types'
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

const toAliasDataWithMultipleComponents = (...parts: string[]): AliasDataWithMultipleComponents => ({
  aliasComponents: parts.map(name => ({
    fieldName: name,
  })),
})

const toAliasDataWithSingleComponent = (fieldName: string): AliasDataWithSingleComponent => ({
  aliasComponents: [{ fieldName }],
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
  aliasComponents: [{
    fieldName: CUSTOM_SEGMENT_FIELD,
    referenceFieldName: CORE_ANNOTATIONS.ALIAS,
  }],
}

const standardTypesAliasMap: Record<StandardType, AliasDataWithSingleComponent> = {
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

const dataTypesAliasMap: Record<SupportedDataType, AliasDataWithMultipleComponents> = {
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
}

const [itemTypes, otherDataTypes] = _.partition(Object.keys(dataTypesAliasMap), isItemType)
const entityIdFallbackAliasMap = Object.fromEntries(otherDataTypes.map(type => [type, entityIdAlias]))
const itemTypesFallbackAliasMap = Object.fromEntries(itemTypes.map(type => [type, itemIdAlias]))

const splitInstancesToGroups = async (instances: InstanceElement[]): Promise<{
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
  elementsSource, elementsMap, aliasMap,
}: {
  elementsSource: ReadOnlyElementsSource
  elementsMap: ElementsMap
  aliasMap: Record<string, AliasDataWithSingleComponent>
}): Promise<void> => {
  const relevantElementsMap = _.pick(elementsMap, Object.keys(aliasMap))
  await awu(Object.keys(relevantElementsMap)).forEach(async group => {
    const { aliasComponents: [{ fieldName }] } = aliasMap[group]

    await awu(relevantElementsMap[group]).forEach(async element => {
      const fieldValue = getElementValueOrAnnotations(element)[fieldName]
      if (!isReferenceExpression(fieldValue) || fieldValue.elemID.typeName !== TRANSLATION_COLLECTION) {
        log.warn(
          'cannot extract translated alias for element %s from field %s -'
          + ' field value is not a translation collection reference: %o',
          element.elemID.getFullName(),
          fieldName,
          fieldValue
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
          'cannot extract translated alias for element %s from reference %s -'
          + ' reference value is not a string: %o',
          element.elemID.getFullName(),
          defaultTranslationElemId,
          alias
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
      .map(([group, elems]) => [
        group,
        elems.filter(element => element.annotations[CORE_ANNOTATIONS.ALIAS] === undefined),
      ] as const)
      .filter(([_group, elems]) => elems.length > 0)
  )

const filterCreator: LocalFilterCreator = ({ config, elementsSource, isPartial }) => ({
  name: 'addAlias',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (config.fetch?.addAlias !== true) {
      log.info('not running addAlias filter as addAlias in the config is false')
      return
    }

    const instances = elements.filter(isInstanceElement)
    const {
      fileCabinetInstances,
      customRecordInstances,
      subInstances,
      otherInstances,
    } = await splitInstancesToGroups(instances)

    const [customRecordTypesWithSegment, customRecordTypes] = _.partition(
      elements.filter(isObjectType).filter(isCustomRecordType),
      type => type.annotations[CUSTOM_SEGMENT_FIELD] !== undefined
    )

    const instancesMap = _.groupBy(otherInstances, instance => instance.elemID.typeName)
    const elementsMap: ElementsMap = {
      ...instancesMap,
      [IS_SUB_INSTANCE]: subInstances,
      [CUSTOM_RECORD_TYPE]: customRecordTypes,
      [CUSTOM_RECORD_INSTANCES]: customRecordInstances,
    }

    addAliasToElements({
      elementsMap,
      aliasMap: {
        ...standardTypesAliasMap,
        ...dataTypesAliasMap,
        [IS_SUB_INSTANCE]: nameAlias,
        [CUSTOM_RECORD_INSTANCES]: nameAlias,
      },
    })

    await addAliasFromTranslatedFields({
      elementsSource: buildElementsSourceFromElements(instances, isPartial ? [elementsSource] : []),
      elementsMap: getElementsWithoutAlias(elementsMap),
      aliasMap: standardTypesAliasMap,
    })

    // some data type instances have a fallback
    addAliasToElements({
      elementsMap: getElementsWithoutAlias(elementsMap),
      aliasMap: {
        ...entityIdFallbackAliasMap,
        ...itemTypesFallbackAliasMap,
        [IS_SUB_INSTANCE]: labelAlias,
      },
    })

    addAliasToElements({
      elementsMap: {
        ...elementsMap,
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
