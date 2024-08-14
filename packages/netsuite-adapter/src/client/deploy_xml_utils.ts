/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import osPath from 'path'
import { logger } from '@salto-io/logging'
import { Graph } from './graph_utils'
import { SDFObjectNode } from './types'
import { isCustomTypeInfo, xmlParser, xmlBuilder } from './utils'
import { OBJECTS_DIR, getCustomTypeInfoPath } from './sdf_parser'

const log = logger(module)

// The '/' prefix is needed to make osPath.resolve treat '~' as the root
const PROJECT_ROOT_TILDE_PREFIX = `${osPath.sep}~`

export const reorderDeployXml = (deployContent: string, dependencyGraph: Graph<SDFObjectNode>): string => {
  const nodesInCycle = new Set(
    dependencyGraph
      .findCycle()
      .flatMap(node => dependencyGraph.getNodeDependencies(node))
      .map(node => node.id),
  )
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
  const deployXml = xmlParser.parse(deployContent)
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

  return xmlBuilder.build(deployXml)
}
