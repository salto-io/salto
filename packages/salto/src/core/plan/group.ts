import { DataNodeMap, GroupedNodeMap, NodeId, buildGroupedGraph, Group } from '@salto/dag'
import { Change, getChangeElement, isField, ElementMap, ChangeDataType } from 'adapter-api'
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
