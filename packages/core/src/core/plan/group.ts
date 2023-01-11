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
import { collections } from '@salto-io/lowerdash'
import { DataNodeMap, NodeId, buildAcyclicGroupedGraph, GroupDAG } from '@salto-io/dag'
import { Change, getChangeData, isField, ChangeGroupIdFunction, ChangeId, ChangeGroupId, ChangeGroupIdFunctionReturn } from '@salto-io/adapter-api'

const { awu } = collections.asynciterable

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

  return buildAcyclicGroupedGraph(diffGraph, groupKey, disjointGroups)
}
