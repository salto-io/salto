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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { NodeId, DataNodeMap } from './nodemap'

const log = logger(module)

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
GroupedNodeMap<T> => log.time(() => {
    const mergeCandidates = new Map<string, NodeId>()
    return (wu(source.evaluationOrder())

      .map((nodeId: NodeId): Group<T> | undefined => {
        const node = source.getData(nodeId)
        if (!node) return undefined
        const groupNodes = {
          groupKey: groupKey(nodeId),
          items: new Map<NodeId, T>([[nodeId, node]]),
        }
        return groupNodes
      })
      .reject(_.isUndefined) as wu.WuIterable<Group<T>>)

      .reduce((result, group) =>
        log.time(() => {
          const deps = wu(group.items.keys())
            .map(nodeId => source.get(nodeId)).flatten()
            .map(dep => result.getGroupIdFromItemId(dep))
            .reject(_.isUndefined) as Iterable<NodeId>
          const groupId = _.uniqueId(`${group.groupKey}-`)
          result.addNode(groupId, deps, group)

          // Try to merge with existing node
          const mergeCandidate = mergeCandidates.get(group.groupKey)
          if (mergeCandidate) {
            const [transformed, success] = result.tryTransform(groupGraph => {
              groupGraph.merge(groupId, mergeCandidate)
              return mergeCandidate
            })
            if (success) return transformed
          }

          // If merge failed, we need to update state of mergeCandidates
          mergeCandidates.set(group.groupKey, groupId)
          return result
        }, 'merge nodes to group %o', group.groupKey), new GroupedNodeMap<T>())
  }, 'build grouped graph for %o nodes', source.size)
