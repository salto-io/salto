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
import { DataNodeMap, GroupedNodeMap, NodeId, buildGroupedGraph, Group } from '@salto-io/dag'
import { Change, getChangeElement, isField, ElementMap, ChangeDataType } from '@salto-io/adapter-api'
import wu from 'wu'

export const findGroupLevelChange = (group: Group<Change>): Change | undefined =>
  wu(group.items.values()).find(
    change => getChangeElement(change).elemID.getFullName() === group.groupKey
  )

export const getOrCreateGroupLevelChange = (group: Group<Change>, beforeElementsMap: ElementMap,
  afterElementsMap: ElementMap): Change =>
  findGroupLevelChange(group) || {
    action: 'modify',
    data: { before: beforeElementsMap[group.groupKey] as ChangeDataType,
      after: afterElementsMap[group.groupKey] as ChangeDataType },
  }


export const buildGroupedGraphFromDiffGraph = (
  diffGraph: DataNodeMap<Change>
): GroupedNodeMap<Change> => {
  const groupKey = (nodeId: NodeId): string => {
    const diffNode = diffGraph.getData(nodeId)
    const element = getChangeElement(diffNode)
    const elemId = isField(element) ? element.parentID : element.elemID
    return elemId.getFullName()
  }

  return buildGroupedGraph(diffGraph, groupKey)
}
