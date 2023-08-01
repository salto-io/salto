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
import { Change, Element, InstanceElement, isField, isInstanceElement, isObjectType, ObjectType, SaltoElementError, SaltoError, TypeElement, TypeReference, Value, Values } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { fieldTypes } from './types/field_types'
import { enums } from './autogen/types/enums'
import { StandardType, getStandardTypes, isStandardTypeName, getStandardTypesNames } from './autogen/types'
import { TypesMap } from './types/object_types'
import { fileCabinetTypesNames, getFileCabinetTypes } from './types/file_cabinet_types'
import { getConfigurationTypes } from './types/configuration_types'
import { CONFIG_FEATURES, CUSTOM_FIELD_PREFIX, CUSTOM_RECORD_TYPE, CUSTOM_RECORD_TYPE_PREFIX, METADATA_TYPE, SOAP, INTERNAL_ID, SCRIPT_ID, PATH, CUSTOM_RECORD_TYPE_NAME_PREFIX, BUNDLE, INTEGRATION } from './constants'
import { SUPPORTED_TYPES } from './data_elements/types'
import { bundleType } from './types/bundle_type'

const { isDefined } = lowerDashValues

export const getElementValueOrAnnotations = (element: Element): Values => (
  isInstanceElement(element) ? element.value : element.annotations
)

export const isStandardType = (type: ObjectType | TypeReference): boolean =>
  isStandardTypeName(type.elemID.name)

export const isCustomRecordType = (type: ObjectType): boolean =>
  type.annotations[METADATA_TYPE] === CUSTOM_RECORD_TYPE

export const isStandardInstanceOrCustomRecordType = (element: Element): boolean => (
  isInstanceElement(element) && isStandardType(element.refType)
) || (
  isObjectType(element) && isCustomRecordType(element)
) || (
  isField(element) && isCustomRecordType(element.parent)
)

export const isCustomRecordTypeName = (name: string): boolean => name.startsWith(CUSTOM_RECORD_TYPE_NAME_PREFIX)

export const isFileCabinetType = (type: ObjectType | TypeReference): boolean =>
  fileCabinetTypesNames.has(type.elemID.name)

export const isFileCabinetInstance = (element: Element): element is InstanceElement =>
  isInstanceElement(element) && isFileCabinetType(element.refType)

export const isFileInstance = (element: Element): boolean =>
  isInstanceElement(element) && element.refType.elemID.name === 'file'

export const isDataObjectType = (element: ObjectType): boolean =>
  element.annotations.source === SOAP

export const isCustomFieldName = (fieldName: string): boolean =>
  fieldName.startsWith(CUSTOM_FIELD_PREFIX)

export const toCustomFieldName = (fieldName: string): string =>
  `${CUSTOM_FIELD_PREFIX}${fieldName}`

export const removeCustomFieldPrefix = (fieldName: string): string =>
  fieldName.slice(CUSTOM_FIELD_PREFIX.length, fieldName.length)

export const addCustomRecordTypePrefix = (name: string): string =>
  `${CUSTOM_RECORD_TYPE_PREFIX}${name}`

export const removeCustomRecordTypePrefix = (name: string): string =>
  name.slice(CUSTOM_RECORD_TYPE_PREFIX.length, name.length)

type MetadataTypes = {
  standardTypes: TypesMap<StandardType>
  additionalTypes: Readonly<Record<string, ObjectType>>
  innerAdditionalTypes: Readonly<Record<string, ObjectType>>
}

export const getMetadataTypes = (): MetadataTypes => {
  const bundle = bundleType()
  return {
    standardTypes: getStandardTypes(),
    additionalTypes: {
      ...getFileCabinetTypes(),
      ...getConfigurationTypes(),
      [BUNDLE]: bundle.type,
    },
    innerAdditionalTypes: {
      ...bundle.innerTypes,
    },
  }
}

export const getTopLevelStandardTypes = (standardTypes: TypesMap<StandardType>): ObjectType[] =>
  Object.values(standardTypes).map(standardType => standardType.type)

export const getInnerStandardTypes = (standardTypes: TypesMap<StandardType>): ObjectType[] =>
  Object.values(standardTypes).flatMap(standardType => Object.values(standardType.innerTypes))

export const metadataTypesToList = (metadataTypes: MetadataTypes): TypeElement[] => {
  const { standardTypes, additionalTypes, innerAdditionalTypes } = metadataTypes
  return [
    ...getTopLevelStandardTypes(standardTypes),
    ...getInnerStandardTypes(standardTypes),
    ...Object.values(enums),
    ...Object.values(additionalTypes),
    ...Object.values(fieldTypes),
    ...Object.values(innerAdditionalTypes),
  ]
}

export const TYPES_TO_SKIP = [
  INTEGRATION, // The imported xml has no values, especially no SCRIPT_ID, for standard
  // integrations and contains only SCRIPT_ID attribute for custom ones.
  // There is no value in fetching them as they contain no data and are not deployable.
  // If we decide to fetch them we should set the SCRIPT_ID by the xml's filename upon fetch.
]

export const SCRIPT_TYPES = [
  'bundleinstallationscript',
  'clientscript',
  'scheduledscript',
  'workflowactionscript',
  'suitelet',
  'mapreducescript',
  'massupdatescript',
  'usereventscript',
  'restlet',
  'sdfinstallationscript',
  'portlet',
  'customrecordactionscript',
]

export const PLUGIN_IMPLEMENTATION_TYPES = [
  'emailcaptureplugin',
  'customglplugin',
  'datasetbuilderplugin',
  'bankstatementparserplugin',
  'ficonnectivityplugin',
  'fiparserplugin',
  'promotionsplugin',
  'workbookbuilderplugin',
  'pluginimplementation',
]

export const FIELD_TYPES = [
  'entitycustomfield',
  'transactionbodycustomfield',
  'transactioncolumncustomfield',
  'itemcustomfield',
  'othercustomfield',
  'itemoptioncustomfield',
  'itemnumbercustomfield',
  'crmcustomfield',
  'customfield',
]

type DeployError = SaltoElementError | SaltoError
export type DeployResult = {
  appliedChanges: Change[]
  errors: DeployError[]
  elemIdToInternalId?: Record<string, string>
  failedFeaturesIds?: string[]
}

export const SUITEAPP_CONFIG_RECORD_TYPES = [
  'USER_PREFERENCES',
  'COMPANY_INFORMATION',
  'COMPANY_PREFERENCES',
  'ACCOUNTING_PREFERENCES',
] as const

export type SuiteAppConfigRecordType = typeof SUITEAPP_CONFIG_RECORD_TYPES[number]

export type SuiteAppConfigTypeName = 'userPreferences' | 'companyInformation' | 'companyPreferences' | 'accountingPreferences'

export const SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES: Record<SuiteAppConfigRecordType, SuiteAppConfigTypeName> = {
  USER_PREFERENCES: 'userPreferences',
  COMPANY_INFORMATION: 'companyInformation',
  COMPANY_PREFERENCES: 'companyPreferences',
  ACCOUNTING_PREFERENCES: 'accountingPreferences',
}

export const SUITEAPP_CONFIG_TYPE_NAMES = Object.values(SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES)

export const isSuiteAppConfigType = (type: ObjectType): boolean =>
  SUITEAPP_CONFIG_TYPE_NAMES.includes(type.elemID.name as SuiteAppConfigTypeName)

export const isSuiteAppConfigInstance = (instance: InstanceElement): boolean =>
  SUITEAPP_CONFIG_TYPE_NAMES.includes(instance.elemID.typeName as SuiteAppConfigTypeName)

export const isSDFConfigTypeName = (typeName: string): boolean =>
  typeName === CONFIG_FEATURES

export const isSDFConfigType = (type: ObjectType | TypeReference): boolean =>
  isSDFConfigTypeName(type.elemID.name)

export const getInternalId = (element: Element): Value =>
  getElementValueOrAnnotations(element)[INTERNAL_ID]

export const hasInternalId = (element: Element): boolean =>
  isDefined(getInternalId(element))

export const getServiceId = (element: Element): string =>
  getElementValueOrAnnotations(element)[isFileCabinetInstance(element) ? PATH : SCRIPT_ID]

export const isBundleType = (type: ObjectType | TypeReference): boolean =>
  type.elemID.typeName === BUNDLE

export const isBundleInstance = (element: Element): element is InstanceElement =>
  isInstanceElement(element) && isBundleType(element.refType)

export const netsuiteSupportedTypes = [
  ...getStandardTypesNames(),
  ...SUPPORTED_TYPES,
  ...SUITEAPP_CONFIG_TYPE_NAMES,
  CONFIG_FEATURES,
]
