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
import { values } from '@salto-io/lowerdash'
import { NodeId, DataNodeMap } from './nodemap'

const log = logger(module)

export interface Group<T> {
  groupKey: string
  items: Map<NodeId, T>
}

export type GroupedNodeMap<T> = DataNodeMap<Group<T>>

export const buildGroupedGraph = <T>(source: DataNodeMap<T>, groupKey: (id: NodeId) => string):
GroupedNodeMap<T> => log.time(() => {
    const mergeCandidates = new Map<string, NodeId>()
    const itemToGroupId = new Map<NodeId, NodeId>()

    const getOrCreateGroupNode = (
      graph: GroupedNodeMap<T>,
      key: string,
      newDeps: ReadonlySet<NodeId>,
    ): NodeId => {
      const mergeCandidate = mergeCandidates.get(key)
      if (mergeCandidate !== undefined) {
        const currentDeps = graph.get(mergeCandidate)
        const filteredNewDeps = new Set(
          wu(newDeps)
            // Skip edges to mergeCandidate to avoid self reference cycle
            .filter(dep => dep !== mergeCandidate)
            .filter(dep => !currentDeps.has(dep))
        )
        if (filteredNewDeps.size === 0) {
          // Merging will not add new edges and therefore cannot create a cycle
          return mergeCandidate
        }
        const candidateDeps = new Set(wu.chain(currentDeps, filteredNewDeps))
        if (!graph.doesCreateCycle(new Map([[mergeCandidate, candidateDeps]]), mergeCandidate)) {
          // Safe to add the new edges and merge to candidate node
          filteredNewDeps.forEach(dep => graph.addEdge(mergeCandidate, dep))
          return mergeCandidate
        }
      }
      // Cannot merge to existing node, create a new one
      const groupId = _.uniqueId(`${key}-`)
      graph.addNode(groupId, newDeps, { groupKey: key, items: new Map() })
      // mergeCandidates should point to the latest node of a given key
      mergeCandidates.set(key, groupId)
      return groupId
    }

    return wu(source.evaluationOrder())
      .reduce((result, nodeId) => {
        const deps = new Set(
          wu(source.get(nodeId))
            .map(depId => itemToGroupId.get(depId))
            .filter(values.isDefined)
        )
        const nodeGroupKey = groupKey(nodeId)
        const groupId = getOrCreateGroupNode(result, nodeGroupKey, deps)
        // Add item to the group node (the dependencies are handled by getOrCreateGroupNode)
        result.getData(groupId).items.set(nodeId, source.getData(nodeId))
        itemToGroupId.set(nodeId, groupId)
        return result
      }, new DataNodeMap<Group<T>>())
  }, 'build grouped graph for %o nodes', source.size)
