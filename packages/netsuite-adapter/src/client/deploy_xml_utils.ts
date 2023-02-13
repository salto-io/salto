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
import _ from 'lodash'
import { Graph, SDFObjectNode } from './graph_utils'
import { CustomizationInfo } from './types'
import { isFileCustomizationInfo, isFolderCustomizationInfo } from './utils'

const isFileOrFolder = (customizationInfo: CustomizationInfo): boolean =>
  isFileCustomizationInfo(customizationInfo) || isFolderCustomizationInfo(customizationInfo)

export const reorderDeployXml = (
  deployContent: string,
  dependencyGraph: Graph<SDFObjectNode>,
): string => {
  const nodesInTopologicalOrder = dependencyGraph.getTopologicalOrder()
  const orderedFileCabinetNodes = _.remove(
    nodesInTopologicalOrder, node => isFileOrFolder(node.value.customizationInfo)
  )
  const deployXml = xmlParser.parse(deployContent, { ignoreAttributes: false })
  const { objects, files } = deployXml.deploy
  if (nodesInTopologicalOrder.length > 0) {
    objects.path = nodesInTopologicalOrder.map(node => `~/Objects/${node.value.serviceid}.xml`)
  }
  if (orderedFileCabinetNodes.length > 0) {
    files.path = orderedFileCabinetNodes.map(node => `~/FileCabinet${node.value.serviceid}`)
  }

  // eslint-disable-next-line new-cap
  return new xmlParser.j2xParser({
    ignoreAttributes: false,
    format: true,
  }).parse(deployXml)
}
