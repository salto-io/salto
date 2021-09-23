/*
*                      Copyright 2021 Salto Labs Ltd.
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
import wu from 'wu'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { NodeId, DataNodeMap, Edge, CircularDependencyError } from './nodemap'

const log = logger(module)

export interface Group<T> {
  groupKey: string
  items: Map<NodeId, T>
}

export type GroupedNodeMap<T> = DataNodeMap<Group<T>>

type Cycle = Edge[]

export type GroupKeyFunc = (id: NodeId) => string

type COMPONENT_VALIDITY_STATUS = 'valid' | 'invalid' | 'in_progress'

const colorComponentsValidity = <T>(
  source: DataNodeMap<T>,
  id: NodeId,
  srcGroupNodes: Set<NodeId>,
  srcNodesWithToRef: Set<NodeId>,
  visited: Map<NodeId, COMPONENT_VALIDITY_STATUS>
): boolean => {
  if (visited.has(id)) {
    return visited.get(id) !== 'invalid'
  }
  visited.set(id, 'in_progress')
  const hasInvalidChildren = wu(source.get(id).values())
    .filter(childId => srcGroupNodes.has(childId))
    .some(childId => !colorComponentsValidity(
      source,
      childId,
      srcGroupNodes,
      srcNodesWithToRef,
      visited
    ))
  const isValid = !hasInvalidChildren && !srcNodesWithToRef.has(id)
  visited.set(id, isValid ? 'valid' : 'invalid')
  return isValid
}

const getComponent = <T>(
  source: DataNodeMap<T>,
  srcGroupNodes: Set<NodeId>,
  id: NodeId,
  visited: Set<NodeId> = new Set()
): Set<NodeId> => {
  if (visited.has(id)) {
    return new Set()
  }
  visited.add(id)
  const children = new Set(
    wu(source.get(id).values())
      .filter(childId => srcGroupNodes.has(childId))
      .map(childId => getComponent(source, srcGroupNodes, childId, visited))
      .flatten(true)
  )
  return children.add(id)
}

const getComponentToSplit = <T>(
  source: DataNodeMap<T>,
  currentGroupNodes: Set<NodeId>,
  srcNodesWithBackRef: Set<NodeId>,
  srcNodesWithToRef: Set<NodeId>,
): Set<NodeId> | undefined => {
  const colorMap = new Map<NodeId, COMPONENT_VALIDITY_STATUS>()
  return wu(srcNodesWithBackRef.keys()).map(root => {
    const isValid = colorComponentsValidity(
      source,
      root,
      currentGroupNodes,
      srcNodesWithToRef,
      colorMap
    )
    if (isValid) {
      const component = getComponent(source, currentGroupNodes, root)
      return component.size < currentGroupNodes.size ? component : undefined
    }
    return undefined
  })
    .find(values.isDefined)
}

const modifyGroupKeyToRemoveCycle = <T>(
  groupGraph: GroupedNodeMap<T>,
  groupKey: GroupKeyFunc,
  source: DataNodeMap<T>,
  knownCycle: Cycle
): GroupKeyFunc => {
  // eslint-disable-next-line no-plusplus
  const modifiedFunc = knownCycle.map((inEdge, index) => {
    const outEdge = knownCycle[(index + 1) % knownCycle.length]
    const [prevGroup, currentGroup, nextGroup] = [...inEdge, outEdge[1]]
    const currentGroupSrcIds = wu(groupGraph.getData(currentGroup).items.keys()).toArray()
    const srcNodesWithBackRef = new Set(currentGroupSrcIds.filter(
      id => wu(source.getReverse(id).values())
        .find(srcId => groupKey(srcId) === prevGroup)
    ))
    const srcNodesWithToRef = new Set(currentGroupSrcIds.filter(
      id => wu(source.get(id).values())
        .find(destId => groupKey(destId) === nextGroup)
    ))
    const componentToSplit = getComponentToSplit(
      source,
      new Set(currentGroupSrcIds),
      srcNodesWithBackRef,
      srcNodesWithToRef,
    )
    if (componentToSplit !== undefined) {
      const newGroupId = _.uniqueId(`${currentGroup}-`)
      return (id: NodeId) => (componentToSplit.has(id) ? newGroupId : groupKey(id))
    }
    return undefined
  }).find(values.isDefined)

  if (values.isDefined(modifiedFunc)) {
    return modifiedFunc
  }
  const origCycle = source.filterNodes(id => !knownCycle.flatMap(e => e).includes(groupKey(id)))
  throw new CircularDependencyError(origCycle)
}

const buildPossiblyCyclicGroupGraph = <T>(
  source: DataNodeMap<T>,
  groupKey: GroupKeyFunc,
  originGroupKey: GroupKeyFunc
): GroupedNodeMap<T> => {
  const itemToGroupId = new Map<NodeId, NodeId>()
  const graph = wu(source.keys())
    .reduce((acc, nodeId) => {
      const groupId = groupKey(nodeId)
      if (!acc.has(groupId)) {
        acc.addNode(groupId, [], {
          groupKey: originGroupKey(nodeId), items: new Map(),
        })
      }
      acc.getData(groupId).items.set(nodeId, source.getData(nodeId))
      itemToGroupId.set(nodeId, groupId)
      return acc
    }, new DataNodeMap<Group<T>>())
  source.edges()
    .filter(([from, to]) => itemToGroupId.get(from) !== itemToGroupId.get(to))
    .forEach(([from, to]) => {
      graph.addEdge(itemToGroupId.get(from) ?? from, itemToGroupId.get(to) ?? to)
    })
  return graph
}

export const buildGroupedGraph = <T>(
  source: DataNodeMap<T>,
  groupKey: GroupKeyFunc,
  originGroupKey: GroupKeyFunc = groupKey
): GroupedNodeMap<T> => log.time(() => {
  // Build group graph
    const groupGraph = buildPossiblyCyclicGroupGraph(source, groupKey, originGroupKey)
    const possibleCycle = groupGraph.getCycle()
    if (possibleCycle === undefined) {
      return groupGraph
    }
    const updatedGroupKey = modifyGroupKeyToRemoveCycle(groupGraph, groupKey, source, possibleCycle)
    return buildGroupedGraph(source, updatedGroupKey, originGroupKey)
  }, 'build grouped graph for %o nodes', source.size)
