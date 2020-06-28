/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { DataNodeMap, GroupedNodeMap, NodeId, buildGroupedGraph, Group } from '@salto-io/dag'
import { Change, getChangeElement, ElementMap, ChangeDataType, isField, ChangeGroupId, ChangeId, ChangeGroupIdFunction } from '@salto-io/adapter-api'

export const findGroupLevelChange = (group: Group<Change>): Change | undefined =>
  wu(group.items.values()).find(
    change => getChangeElement(change).elemID.getFullName() === group.groupKey
  )

export const getOrCreateGroupLevelChange = (group: Group<Change>, beforeElementsMap: ElementMap,
  afterElementsMap: ElementMap): Change => {
  const groupChange = findGroupLevelChange(group)
  if (groupChange) {
    return groupChange
  }
  const before = beforeElementsMap[group.groupKey] as ChangeDataType | undefined
  const after = afterElementsMap[group.groupKey] as ChangeDataType | undefined
  if (before && after) {
    return { action: 'modify', data: { before, after } }
  }
  if (after) {
    // This is an add change that got split into multiple parts, the main addition is part of
    // a different group that must happen before this change so here we actually modify
    return { action: 'modify', data: { before: after, after } }
  }
  // This is a remove change that got split into multiple parts
  return { action: 'remove', data: { before: before as ChangeDataType } }
}

export const getCustomGroupIds = async (
  changes: DataNodeMap<Change>,
  customGroupIdFunctions: Record<string, ChangeGroupIdFunction>,
): Promise<Map<ChangeId, ChangeGroupId>> => {
  if (Object.keys(customGroupIdFunctions).length === 0) {
    return new Map()
  }

  const changesPerAdapter = collections.iterable.groupBy(
    wu(changes.keys()).map(id => ({ id, change: changes.getData(id) })),
    ({ change }) => getChangeElement(change).elemID.adapter,
  )

  const changeGroupIds = wu(changesPerAdapter.entries())
    .filter(([adapterName]) => adapterName in customGroupIdFunctions)
    .map(([name, adapterChanges]) => (
      customGroupIdFunctions[name](new Map(adapterChanges.map(({ id, change }) => [id, change])))
    ))

  return new Map(
    (await Promise.all(changeGroupIds)).flatMap(changeIdsMap => [...changeIdsMap.entries()])
  )
}


export const buildGroupedGraphFromDiffGraph = (
  diffGraph: DataNodeMap<Change>, customGroupKeys?: Map<ChangeId, ChangeGroupId>
): GroupedNodeMap<Change> => {
  const groupKey = (nodeId: NodeId): string => {
    const customKey = customGroupKeys?.get(nodeId)
    if (customKey !== undefined) {
      return customKey
    }
    const diffNode = diffGraph.getData(nodeId)
    const changeElement = getChangeElement(diffNode)
    const groupElement = isField(changeElement) ? changeElement.parent : changeElement
    return groupElement.elemID.getFullName()
  }

  return buildGroupedGraph(diffGraph, groupKey)
}
