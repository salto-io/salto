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

const getComponentWithoutNodestoAvoid = <T>(
  source: DataNodeMap<T>,
  currentGroupNodes: Set<NodeId>,
  possibleStartNodes: Set<NodeId>,
  nodesToAvoid: Set<NodeId>,
): Set<NodeId> | undefined => {
  const componentToAvoid = source.getComponent({
    roots: [...nodesToAvoid.keys()],
    filterFunc: id => currentGroupNodes.has(id),
    reverse: true,
  })

  const validStartNode = wu(possibleStartNodes).find(id => !componentToAvoid.has(id))
  return validStartNode !== undefined
    ? source.getComponent({ roots: [validStartNode], filterFunc: id => currentGroupNodes.has(id) })
    : undefined
}

const modifyGroupKeyToRemoveCycle = <T>(
  groupGraph: GroupedNodeMap<T>,
  groupKey: GroupKeyFunc,
  source: DataNodeMap<T>,
  knownCycle: Cycle
): GroupKeyFunc => {
  // This function will attempt to return a new group that if created, will
  // will split the cycle between inEdge and outEdge. The new group can be
  // created if there is a node in the group which is a target of `inEdge`
  // and its connected component does not contain nodes that are a part of
  // outEdge
  const getNewGroupToCreateToRemoveEdgeFromCycle = (
    inEdge: Edge,
    outEdge: Edge
  ): { nodesID: Set<NodeId>; newGroupId: string }| undefined => {
    const [prevGroup, currentGroup, nextGroup] = [...inEdge, outEdge[1]]
    const currentGroupSrcIds = wu(groupGraph.getData(currentGroup).items.keys()).toArray()
    const sourceNodesWithBackRef = new Set(currentGroupSrcIds.filter(
      id => wu(source.getReverse(id).values())
        .some(srcId => groupKey(srcId) === prevGroup)
    ))
    const sourceNodesWithForwardRef = new Set(currentGroupSrcIds.filter(
      id => wu(source.get(id).values())
        .some(destId => groupKey(destId) === nextGroup)
    ))
    const componentToSplit = getComponentWithoutNodestoAvoid(
      source,
      new Set(currentGroupSrcIds),
      sourceNodesWithBackRef,
      sourceNodesWithForwardRef,
    )
    if (componentToSplit !== undefined) {
      const newGroupId = _.uniqueId(`${currentGroup}-`)
      return { newGroupId, nodesID: componentToSplit }
    }
    return undefined
  }

  const newGroup = knownCycle.map((inEdge, index) => {
    const outEdge = knownCycle[(index + 1) % knownCycle.length]
    return getNewGroupToCreateToRemoveEdgeFromCycle(inEdge, outEdge)
  }).find(values.isDefined)

  if (values.isDefined(newGroup)) {
    return (id: NodeId) => (newGroup.nodesID.has(id)
      ? newGroup.newGroupId
      : groupKey(id))
  }

  // We create a graph that contains only the nodes and edges from this cycle
  // in order to creat an error with the original cycle in the source graph
  // (since using the group names would mean nothing to the user)
  const knowCycleNodes = new Set(knownCycle.flat())
  const origCycle = source.filterNodes(id => knowCycleNodes.has(groupKey(id)))
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
    return new DAG(groupGraph.entries(), groupGraph.nodeData)
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
): GroupDAG<T> => log.time(
    () => buildAcyclicGroupedGraphImpl(source, groupKey, groupKey),
    'build grouped graph for %o nodes',
    source.size
  )
