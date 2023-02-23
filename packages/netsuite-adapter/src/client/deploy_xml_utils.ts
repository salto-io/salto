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

import xmlParser from 'fast-xml-parser'
import osPath from 'path'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { Graph, SDFObjectNode } from './graph_utils'
import { CustomizationInfo, CustomTypeInfo, FileCustomizationInfo, FolderCustomizationInfo } from './types'
import { isCustomTypeInfo, isFileCustomizationInfo, isFolderCustomizationInfo } from './utils'

type FileCabinetCustomType = FileCustomizationInfo | FolderCustomizationInfo
const log = logger(module)

export const XML_FILE_SUFFIX = '.xml'
export const FILE_CABINET_DIR = 'FileCabinet'
export const OBJECTS_DIR = 'Objects'
export const ATTRIBUTES_FOLDER_NAME = '.attributes'
export const FOLDER_ATTRIBUTES_FILE_SUFFIX = `.folder.attr${XML_FILE_SUFFIX}`
export const ATTRIBUTES_FILE_SUFFIX = `.attr${XML_FILE_SUFFIX}`
// The '/' prefix is needed to make osPath.resolve treat '~' as the root
const PROJECT_ROOT_TILDE_PREFIX = `${osPath.sep}~`

const isFileCabinetCustomType = (customizationInfo: CustomizationInfo): customizationInfo is FileCabinetCustomType =>
  isFileCustomizationInfo(customizationInfo) || isFolderCustomizationInfo(customizationInfo)

export const getCustomTypeInfoPath = (
  dirPath: string,
  customTypeInfo: CustomTypeInfo,
  fileExtension = XML_FILE_SUFFIX
): string =>
  osPath.resolve(dirPath, OBJECTS_DIR, `${customTypeInfo.scriptId}${fileExtension}`)

export const getFileCabinetTypesPath = (dirPath: string, fileCabinetCustTypeInfo: FileCabinetCustomType): string => {
  if (isFileCustomizationInfo(fileCabinetCustTypeInfo)) {
    return osPath.resolve(dirPath, FILE_CABINET_DIR, ...fileCabinetCustTypeInfo.path.slice(0, -1))
  }
  return osPath.resolve(dirPath, FILE_CABINET_DIR, ...fileCabinetCustTypeInfo.path)
}

const getFileOrFolderString = (fileCabinetCusTypeInfo: FileCabinetCustomType): string => {
  const filename = fileCabinetCusTypeInfo.path.slice(-1)[0]
  if (isFolderCustomizationInfo(fileCabinetCusTypeInfo)) {
    return `${getFileCabinetTypesPath(PROJECT_ROOT_TILDE_PREFIX, fileCabinetCusTypeInfo)}${osPath.sep}*`
  }
  return `${getFileCabinetTypesPath(PROJECT_ROOT_TILDE_PREFIX, fileCabinetCusTypeInfo)}${osPath.sep}${filename}`
}

export const reorderDeployXml = (
  deployContent: string,
  dependencyGraph: Graph<SDFObjectNode>,
): string => {
  const custInfosInTopologicalOrder = dependencyGraph.getTopologicalOrder()
    .map(node => node.value.customizationInfo)

  const [fileCabinetCustInfos, customTypeInfos] = _.partition(
    custInfosInTopologicalOrder, isFileCabinetCustomType
  )
  const deployXml = xmlParser.parse(deployContent, { ignoreAttributes: false })
  const { objects, files } = deployXml.deploy

  if (customTypeInfos.length > 0) {
    log.debug('Deploying %d objects in the following order: %o', customTypeInfos.length, customTypeInfos.filter(isCustomTypeInfo).map(custTypeInfo => custTypeInfo.scriptId))
    objects.path = customTypeInfos
      .filter(isCustomTypeInfo)
      .map(custTypeInfo => getCustomTypeInfoPath(PROJECT_ROOT_TILDE_PREFIX, custTypeInfo))
      .map(path => path.slice(1)) // remove the '/' prefix
    objects.path.push(['~', OBJECTS_DIR, '*'].join(osPath.sep))
  }
  if (fileCabinetCustInfos.length > 0) {
    log.debug('Deploying %d file cabinet objects in the following order: %o', fileCabinetCustInfos.length, fileCabinetCustInfos.map(custTypeInfo => custTypeInfo.path))
    files.path = fileCabinetCustInfos
      .map(custInfo => getFileOrFolderString(custInfo))
      .map(path => path.slice(1))
  }

  // eslint-disable-next-line new-cap
  return new xmlParser.j2xParser({
    ignoreAttributes: false,
    format: true,
  }).parse(deployXml)
}
