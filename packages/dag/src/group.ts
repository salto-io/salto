import wu from 'wu'
import _ from 'lodash'
import { NodeId, DataNodeMap } from './nodemap'

export interface Group<T> {
  groupKey: string
  items: Map<NodeId, T>
}

export class GroupedNodeMap<T> extends DataNodeMap<Group<T>> {
  getItems(groupId: NodeId): Map<NodeId, T> {
    return _.get(this.getData(groupId) || {}, 'items')
  }

  getGroupIdFromItemId(nodeId: NodeId): NodeId | undefined {
    return wu(this.nodes()).find(g => this.getItems(g).has(nodeId))
  }

  merge(from: NodeId, to: NodeId): void {
    const toGroup = this.getData(to)
    const fromGroup = this.getData(from)
    if (!fromGroup || !toGroup || fromGroup.groupKey !== toGroup.groupKey) {
      throw Error(`Cannot merge ${JSON.stringify(fromGroup)} to ${JSON.stringify(toGroup)}`)
    }
    // Clone toGroup so upon merge failures graph will not be "dirty"
    const toGroupClone = { groupKey: toGroup.groupKey, items: _.clone(toGroup.items) }
    wu(fromGroup.items.entries()).forEach(([id, item]) => toGroupClone.items.set(id, item))
    this.setData(to, toGroupClone)
    this.get(from).forEach(dep => {
      if (dep !== to) {
        this.get(to).add(dep)
      }
    })
    this.deleteNode(from)
  }
}

export const buildGroupedGraph = <T>(source: DataNodeMap<T>,
  groupKey: (id: NodeId) => string): GroupedNodeMap<T> => {
  let result = new GroupedNodeMap<T>()
  const findGroupDependencies = (nodeId: NodeId): Iterable<NodeId> =>
    wu(source.get(nodeId))
      .map(dep => result.getGroupIdFromItemId(dep))
      .reject(_.isUndefined) as Iterable<NodeId>

  const groupKeyToLastGroupId = new Map<string, NodeId>()
  wu(source.evaluationOrder()).forEach(nodeId => {
    const node = source.getData(nodeId)
    if (!node) return
    const newGroupId = _.uniqueId(`${groupKey(nodeId)}-`)
    const newGroup = {
      groupKey: groupKey(nodeId),
      items: new Map<NodeId, T>([[nodeId, node]]),
    }
    result.addNode(newGroupId, findGroupDependencies(nodeId), newGroup)

    const mergeCandidate = groupKeyToLastGroupId.get(groupKey(nodeId))
    if (mergeCandidate) {
      result = result.tryTransform((groupGraph: GroupedNodeMap<T>): NodeId => {
        groupGraph.merge(newGroupId, mergeCandidate)
        return mergeCandidate
      }, { onError: () => groupKeyToLastGroupId.set(groupKey(nodeId), newGroupId) })
    } else {
      groupKeyToLastGroupId.set(groupKey(nodeId), newGroupId)
    }
  })

  return result
}
