/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { DeployResult as AdapterApiDeployResult, Element, InstanceElement, isField, isInstanceElement, isObjectType, ObjectType, PrimitiveType, TypeElement, TypeReference, Values } from '@salto-io/adapter-api'
import { fieldTypes } from './types/field_types'
import { enums } from './autogen/types/enums'
import { CustomType, getCustomTypes, isCustomTypeName } from './autogen/types'
import { TypesMap } from './types/object_types'
import { fileCabinetTypesNames, getFileCabinetTypes } from './types/file_cabinet_types'
import { getConfigurationTypes } from './types/configuration_types'
import { CONFIG_FEATURES, CUSTOM_RECORD_TYPE, METADATA_TYPE } from './constants'

export const getElementValueOrAnnotations = (element: Element): Values => (
  isInstanceElement(element) ? element.value : element.annotations
)

export const isCustomType = (type: ObjectType | TypeReference): boolean =>
  isCustomTypeName(type.elemID.name)

export const isCustomRecordType = (type: ObjectType): boolean =>
  type.annotations[METADATA_TYPE] === CUSTOM_RECORD_TYPE

export const isCustomTypeElement = (element: Element): boolean => (
  isInstanceElement(element) && isCustomType(element.refType)
) || (
  isObjectType(element) && isCustomRecordType(element)
) || (
  isField(element) && isCustomRecordType(element.parent)
)

export const isFileCabinetType = (type: ObjectType | TypeReference): boolean =>
  fileCabinetTypesNames.has(type.elemID.name)

export const isFileCabinetInstance = (element: Element): element is InstanceElement =>
  isInstanceElement(element) && isFileCabinetType(element.refType)

export const isFileInstance = (element: Element): boolean =>
  isInstanceElement(element) && element.refType.elemID.name === 'file'

export const isDataObjectType = (element: ObjectType): boolean =>
  element.annotations.source === 'soap'

type MetadataTypes = {
  customTypes: TypesMap<CustomType>
  enums: Readonly<Record<string, PrimitiveType>>
  additionalTypes: Readonly<Record<string, ObjectType>>
  fieldTypes: Readonly<Record<string, PrimitiveType>>
}

export const getMetadataTypes = (): MetadataTypes => ({
  customTypes: getCustomTypes(),
  enums,
  additionalTypes: { ...getFileCabinetTypes(), ...getConfigurationTypes() },
  fieldTypes,
})

export const getTopLevelCustomTypes = (customTypes: TypesMap<CustomType>): ObjectType[] =>
  Object.values(customTypes).map(customType => customType.type)

export const getInnerCustomTypes = (customTypes: TypesMap<CustomType>): ObjectType[] =>
  Object.values(customTypes).flatMap(customType => Object.values(customType.innerTypes))

export const metadataTypesToList = (metadataTypes: MetadataTypes): TypeElement[] => {
  const { customTypes, additionalTypes } = metadataTypes
  return [
    ...getTopLevelCustomTypes(customTypes),
    ...getInnerCustomTypes(customTypes),
    ...Object.values(enums),
    ...Object.values(additionalTypes),
    ...Object.values(fieldTypes),
  ]
}

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

export type DeployResult = AdapterApiDeployResult & {
  elemIdToInternalId?: Record<string, string>
}

export const SUITEAPP_CONFIG_RECORD_TYPES = [
  'USER_PREFERENCES',
  'COMPANY_INFORMATION',
  'COMPANY_PREFERENCES',
  'ACCOUNTING_PREFERENCES',
] as const

export type SuiteAppConfigRecordType = typeof SUITEAPP_CONFIG_RECORD_TYPES[number]

export const SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES: Record<SuiteAppConfigRecordType, string> = {
  USER_PREFERENCES: 'userPreferences',
  COMPANY_INFORMATION: 'companyInformation',
  COMPANY_PREFERENCES: 'companyPreferences',
  ACCOUNTING_PREFERENCES: 'accountingPreferences',
}

export const SUITEAPP_CONFIG_TYPE_NAMES = Object.values(SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES)

export const isSuiteAppConfigType = (type: ObjectType): boolean =>
  SUITEAPP_CONFIG_TYPE_NAMES.includes(type.elemID.name)

export const isSuiteAppConfigInstance = (instance: InstanceElement): boolean =>
  SUITEAPP_CONFIG_TYPE_NAMES.includes(instance.elemID.typeName)

export const isSDFConfigTypeName = (typeName: string): boolean =>
  typeName === CONFIG_FEATURES

export const isSDFConfigType = (type: ObjectType | TypeReference): boolean =>
  isSDFConfigTypeName(type.elemID.name)
