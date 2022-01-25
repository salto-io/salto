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
import { DeployResult as AdapterApiDeployResult, Element, InstanceElement, isInstanceElement, ObjectType, TypeElement, ElemID, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { fieldTypes } from './types/field_types'
import { enums } from './autogen/types/enums'
import { customTypes, innerCustomTypes } from './autogen/types'
import { file, folder } from './types/file_cabinet_types'

const { awu } = collections.asynciterable

export { customTypes } from './autogen/types'

export const fileCabinetTypes: Readonly<Record<string, ObjectType>> = {
  file,
  folder,
}

export const isCustomType = (typeElemID: ElemID): boolean =>
  !_.isUndefined(customTypes[typeElemID.name])

export const isFileCabinetType = (typeElemID: ElemID): boolean =>
  !_.isUndefined(fileCabinetTypes[typeElemID.name])

export const isFileCabinetInstance = (element: Element): element is InstanceElement =>
  isInstanceElement(element) && isFileCabinetType(element.refType.elemID)

export const isFileInstance = (element: Element): boolean =>
  isInstanceElement(element) && element.refType.elemID.name === 'file'

export const isDataObjectType = (element: ObjectType): boolean =>
  element.annotations.source === 'soap'

export const getMetadataTypes = (): TypeElement[] => [
  ...Object.values(customTypes),
  ...innerCustomTypes,
  ...Object.values(enums),
  ...Object.values(fileCabinetTypes),
  ...Object.values(fieldTypes),
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
export const typesElementSourceWrapper = (
): ReadOnlyElementsSource => {
  const typesByKey = _.keyBy(
    getMetadataTypes(),
    type => type.elemID.getFullName()
  )
  return {
    get: async elemID => typesByKey[elemID.getFullName()],
    getAll: async () => awu(Object.values(typesByKey)),
    has: async elemID => typesByKey[elemID.getFullName()] !== undefined,
    list: async () => awu(Object.keys(typesByKey).map(ElemID.fromFullName)),
  }
}

export type DeployResult = AdapterApiDeployResult & {
  elemIdToInternalId?: Record<string, string>
}
