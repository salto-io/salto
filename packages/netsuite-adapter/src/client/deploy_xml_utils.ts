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

import xmlParser from 'fast-xml-parser'
import osPath from 'path'
import { logger } from '@salto-io/logging'
import { Graph } from './graph_utils'
import { SDFObjectNode } from './types'
import { isCustomTypeInfo } from './utils'
import { OBJECTS_DIR, getCustomTypeInfoPath } from './sdf_parser'

const log = logger(module)

// The '/' prefix is needed to make osPath.resolve treat '~' as the root
const PROJECT_ROOT_TILDE_PREFIX = `${osPath.sep}~`

export const reorderDeployXml = (deployContent: string, dependencyGraph: Graph<SDFObjectNode>): string => {
  const nodesInCycle = new Set(dependencyGraph.findCycle())
  log.debug(
    'The following %d objects will not be written explicity in the deploy xml since they contain a cycle: %o',
    nodesInCycle.size,
    [...nodesInCycle],
  )
  const custInfosInTopologicalOrder = dependencyGraph
    .getTopologicalOrder()
    .filter(node => !nodesInCycle.has(node.id))
    .map(node => node.value.customizationInfo)

  const customTypeInfos = custInfosInTopologicalOrder.filter(isCustomTypeInfo)
  const deployXml = xmlParser.parse(deployContent, { ignoreAttributes: false })
  const { objects } = deployXml.deploy

  if (customTypeInfos.length > 0) {
    log.debug(
      'Deploying %d objects in the following order: %o',
      customTypeInfos.length,
      customTypeInfos.map(custTypeInfo => custTypeInfo.scriptId),
    )
    objects.path = customTypeInfos
      .map(custTypeInfo => getCustomTypeInfoPath(PROJECT_ROOT_TILDE_PREFIX, custTypeInfo))
      .map(path => path.slice(1)) // remove the '/' prefix
    objects.path.push(['~', OBJECTS_DIR, '*'].join(osPath.sep))
  }

  // eslint-disable-next-line new-cap
  return new xmlParser.j2xParser({
    ignoreAttributes: false,
    format: true,
  }).parse(deployXml)
}
