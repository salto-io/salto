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

export const buildGroupedGraph = <T>(source: DataNodeMap<T>, groupKey: (id: NodeId) => string):
GroupedNodeMap<T> => {
  const mergeCandidates = new Map<string, NodeId>()
  return (wu(source.evaluationOrder())

    .map((nodeId: NodeId): Group<T> | undefined => {
      const node = source.getData(nodeId)
      if (!node) return undefined
      return {
        groupKey: groupKey(nodeId),
        items: new Map<NodeId, T>([[nodeId, node]]),
      }
    }).reject(_.isUndefined) as wu.WuIterable<Group<T>>)

    .reduce((result, group) => {
      const deps = wu(group.items.keys())
        .map(nodeId => source.get(nodeId)).flatten()
        .map(dep => result.getGroupIdFromItemId(dep))
        .reject(_.isUndefined) as Iterable<NodeId>
      const groupId = _.uniqueId(`${group.groupKey}-`)
      result.addNode(groupId, deps, group)

      // Try to merge withe existing node
      const mergeCandidate = mergeCandidates.get(group.groupKey)
      if (mergeCandidate) {
        return result.tryTransform((groupGraph: GroupedNodeMap<T>): NodeId => {
          groupGraph.merge(groupId, mergeCandidate)
          return mergeCandidate
        }, { onError: () => mergeCandidates.set(group.groupKey, groupId) })
      }

      mergeCandidates.set(group.groupKey, groupId)
      return result
    }, new GroupedNodeMap<T>())
}
