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
import { NodeId, DataNodeMap, Edge, CircularDependencyError, DAG } from './nodemap'

const log = logger(module)

export interface Group<T> {
  groupKey: string
  items: Map<NodeId, T>
}

export type GroupedNodeMap<T> = DataNodeMap<Group<T>>
export type GroupDAG<T> = DAG<Group<T>>

type Cycle = Edge[]

export type GroupKeyFunc = (id: NodeId) => string

type COMPONENT_VALIDITY_STATUS = 'valid' | 'invalid' | 'in_progress'

// This method will color the validity of the nodes in the group
// a node is said to be a valid part of a detacheable subgroup if
// it's connected component does not contain nodes that have edges
// to the next group in the cycle. We identify a node validity by
// performing a DFS from that node and updatinng a "visited" map
// with the validity status. If A node is valid if *all* of its children
// are valid. So if we encounter an invalid node, we mark this node as invalid.
// If we encounter a node which is 'in progress' this means that we found
// a cycle whithin the group, which is ok, and we can ignore this node in the
// calculation until the DFS will return to it.
const colorComponentsValidity = <T>({ source, id, srcGroupNodes,
  srcNodesWithToRef, visited }: {
  source: DataNodeMap<T>
  id: NodeId
  srcGroupNodes: Set<NodeId>
  srcNodesWithToRef: Set<NodeId>
  visited: Map<NodeId, COMPONENT_VALIDITY_STATUS>
}): boolean => {
  if (visited.has(id)) {
    return visited.get(id) !== 'invalid'
  }
  visited.set(id, 'in_progress')
  const isValid = !srcNodesWithToRef.has(id)
    // the code below checks if the node has invalid children -
    // This is not in  a seperate more readable variable
    // in order to avoid calculation if this node in itsef is invalid
    && wu(source.get(id).values())
      .filter(childId => srcGroupNodes.has(childId))
      .every(childId => colorComponentsValidity({
        source,
        id: childId,
        srcGroupNodes,
        srcNodesWithToRef,
        visited,
      }))
  visited.set(id, isValid ? 'valid' : 'invalid')
  return isValid
}

const getComponentToSplit = <T>(
  source: DataNodeMap<T>,
  currentGroupNodes: Set<NodeId>,
  srcNodesWithBackRef: Set<NodeId>,
  srcNodesWithToRef: Set<NodeId>,
): Set<NodeId> | undefined => {
  const visited = new Map<NodeId, COMPONENT_VALIDITY_STATUS>()
  return wu(srcNodesWithBackRef.keys()).map(root => {
    const isValid = colorComponentsValidity({
      source,
      id: root,
      srcGroupNodes: currentGroupNodes,
      srcNodesWithToRef,
      visited,
    })
    if (isValid) {
      const component = source.getComponent({
        root,
        filterFunc: id => currentGroupNodes.has(id),
      })
      // We need to make sure that the component is not the entire group in order
      // to make sure that the algorithm converge. (As long as the number of total groups
      // increases every iteration, we know the number of iteration is bounded by the number
      // of nodes since this is the maximal possible number of groups. Without this check, the
      // total number of group can remain the same after an iteration.)
      return component.size > 0 && component.size < currentGroupNodes.size
        ? component
        : undefined
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
  const modifiedFunc = knownCycle.map((inEdge, index) => {
    const outEdge = knownCycle[(index + 1) % knownCycle.length]
    const [prevGroup, currentGroup, nextGroup] = [...inEdge, outEdge[1]]
    const currentGroupSrcIds = wu(groupGraph.getData(currentGroup).items.keys()).toArray()
    const sourceNodesWithBackRef = new Set(currentGroupSrcIds.filter(
      id => wu(source.getReverse(id).values())
        .find(srcId => groupKey(srcId) === prevGroup)
    ))
    const sourceNodesWithToRef = new Set(currentGroupSrcIds.filter(
      id => wu(source.get(id).values())
        .find(destId => groupKey(destId) === nextGroup)
    ))
    const componentToSplit = getComponentToSplit(
      source,
      new Set(currentGroupSrcIds),
      sourceNodesWithBackRef,
      sourceNodesWithToRef,
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
  // We create a graph that contains only the nodes and edges from this cycle
  // in order to creat an error with the original cycle in the source graph
  // (since using the group names would mean nothing to the user)
  const origCycle = source.filterNodes(id => knownCycle.flatMap(e => e).includes(groupKey(id)))
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
      // The casting is linter bakshish. We know the keys are there.
      graph.addEdge(itemToGroupId.get(from) as NodeId, itemToGroupId.get(to) as NodeId)
    })
  return graph
}

const buildAcyclicGroupedGraphImpl = <T>(
  source: DataNodeMap<T>,
  groupKey: GroupKeyFunc,
  origGroupKey: GroupKeyFunc
): GroupDAG<T> => {
  // Build group graph
  const groupGraph = buildPossiblyCyclicGroupGraph(source, groupKey, origGroupKey)
  const possibleCycle = groupGraph.getCycle()
  if (possibleCycle === undefined) {
    return new DAG(wu(groupGraph).map(([k, v]) => [k, new Set<NodeId>(v)]))
      .setDataFrom(groupGraph) as GroupDAG<T>
  }
  const updatedGroupKey = modifyGroupKeyToRemoveCycle(
    groupGraph,
    groupKey,
    source,
    possibleCycle
  )
  return buildAcyclicGroupedGraphImpl(source, updatedGroupKey, origGroupKey)
}

export const buildAcyclicGroupedGraph = <T>(
  source: DataNodeMap<T>,
  groupKey: GroupKeyFunc,
): GroupDAG<T> => log.time(() => buildAcyclicGroupedGraphImpl(source, groupKey, groupKey), 'build grouped graph for %o nodes', source.size)
