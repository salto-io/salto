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
import wu from 'wu'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { DataNodeMap, NodeId, buildAcyclicGroupedGraph, GroupDAG, GroupKeyFunc } from '@salto-io/dag'
import { Change, getChangeData, isField, ChangeGroupIdFunction, ChangeId, ChangeGroupId, ChangeGroupIdFunctionReturn, isAdditionOrRemovalChange, isObjectTypeChange, isFieldChange } from '@salto-io/adapter-api'

const log = logger(module)
const { awu } = collections.asynciterable
const { DefaultMap } = collections.map

export const mergeChangeGroupInfo = (
  changeGroupInfoPerAdapter: ChangeGroupIdFunctionReturn[]
): ChangeGroupIdFunctionReturn => {
  const mergedChangeGroupIdMap = new Map<ChangeId, ChangeGroupId>(
    wu(changeGroupInfoPerAdapter)
      .map(({ changeGroupIdMap }) => changeGroupIdMap.entries())
      .flatten(true)
  )

  const mergedDisjointGroups = new Set<ChangeGroupId>(
    wu(changeGroupInfoPerAdapter)
      .map(({ disjointGroups }) => disjointGroups?.values() ?? [])
      .flatten(true)
  )

  return {
    changeGroupIdMap: mergedChangeGroupIdMap,
    disjointGroups: mergedDisjointGroups,
  }
}

export const getCustomGroupIds = async (
  changes: DataNodeMap<Change>,
  customGroupIdFunctions: Record<string, ChangeGroupIdFunction>,
): Promise<ChangeGroupIdFunctionReturn> => {
  if (Object.keys(customGroupIdFunctions).length === 0) {
    return { changeGroupIdMap: new Map() }
  }
  const changesPerAdapter = collections.iterable.groupBy(
    wu(changes.keys()).map(id => ({ id, change: changes.getData(id) })),
    ({ change }) => getChangeData(change).elemID.adapter,
  )
  const changeGroupInfoPerAdapter = await awu(changesPerAdapter.entries())
    .filter(([adapterName]) => adapterName in customGroupIdFunctions)
    .map(([name, adapterChanges]) => (
      customGroupIdFunctions[name](new Map(adapterChanges.map(({ id, change }) => [id, change])))
    )).toArray()

  return mergeChangeGroupInfo(changeGroupInfoPerAdapter)
}

// If we add / remove an object type, we can omit all the field add / remove
// changes from the same group since they are included in the parent change
const removeRedundantFieldNodes = (
  graph: DataNodeMap<Change>,
  groupKey: GroupKeyFunc
): DataNodeMap<Change> => log.time(() => {
  const groupIdToAddedOrRemovedTypesMap = new DefaultMap<string, Map<string, collections.set.SetId>>(() => new Map())
  wu(graph.keys()).forEach(nodeId => {
    const change = graph.getData(nodeId)
    if (isAdditionOrRemovalChange(change) && isObjectTypeChange(change)) {
      groupIdToAddedOrRemovedTypesMap.get(groupKey(nodeId)).set(getChangeData(change).elemID.getFullName(), nodeId)
    }
  })
  const getParentForRedundantChanges = (nodeId: collections.set.SetId): collections.set.SetId | undefined => {
    const change = graph.getData(nodeId)
    if (!isAdditionOrRemovalChange(change) || !isFieldChange(change)) {
      return undefined
    }
    const parentNodeId = groupIdToAddedOrRemovedTypesMap
      .get(groupKey(nodeId))
      .get(getChangeData(change).parent.elemID.getFullName())
    return parentNodeId
  }

  const graphWithoutRedundantFieldNodes = new DataNodeMap<Change>()
  wu(graph.keys()).forEach(nodeId => {
    const parentNodeId = getParentForRedundantChanges(nodeId)
    const nodeIdOrParent = parentNodeId ?? nodeId
    if (!graphWithoutRedundantFieldNodes.nodeData.has(nodeIdOrParent)) {
      graphWithoutRedundantFieldNodes.addNode(
        nodeIdOrParent,
        wu(graph.get(nodeIdOrParent))
          .map(id => getParentForRedundantChanges(id) ?? id)
          .filter(id => id !== nodeIdOrParent),
        graph.getData(nodeIdOrParent)
      )
    }
    if (parentNodeId !== undefined) {
      wu(graph.get(nodeId))
        .map(id => getParentForRedundantChanges(id) ?? id)
        .filter(id => id !== parentNodeId)
        .forEach(id => {
          graphWithoutRedundantFieldNodes.addEdge(parentNodeId, id)
        })
    }
  })

  return graphWithoutRedundantFieldNodes
}, 'removeRedundantFieldNodes')

export const buildGroupedGraphFromDiffGraph = (
  diffGraph: DataNodeMap<Change>,
  customGroupKeys?: Map<ChangeId, ChangeGroupId>,
  disjointGroups?: Set<ChangeGroupId>,
): GroupDAG<Change> => {
  const groupKey = (nodeId: NodeId): string => {
    const customKey = customGroupKeys?.get(nodeId)
    if (customKey !== undefined) {
      return customKey
    }
    const diffNode = diffGraph.getData(nodeId)
    const changeData = getChangeData(diffNode)
    const groupElement = isField(changeData) ? changeData.parent : changeData
    return groupElement.elemID.getFullName()
  }

  return buildAcyclicGroupedGraph(
    removeRedundantFieldNodes(diffGraph, groupKey),
    groupKey,
    disjointGroups
  )
}
