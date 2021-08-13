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
import { NodeId, DataNodeMap, CircularDependencyError } from './nodemap'

const log = logger(module)

export interface Group<T> {
  groupKey: string
  items: Map<NodeId, T>
}

export type GroupedNodeMap<T> = DataNodeMap<Group<T>>

export const buildGroupedGraph = <T>(
  source: DataNodeMap<T>, groupKey: (id: NodeId) => string
): GroupedNodeMap<T> => log.time(() => {
    const mergeCandidates = new Map<string, NodeId>()
    const itemToGroupId = new Map<NodeId, NodeId>()
    const getOrCreateGroupNode = (
      graph: GroupedNodeMap<T>,
      key: string,
      newDeps: ReadonlySet<NodeId>,
      newRevDeps: ReadonlySet<NodeId>,
    ): NodeId | undefined => {
      const tryToAddToGroupID = (idToTry: NodeId): boolean => {
        const currentDeps = graph.get(idToTry)
        const filteredNewDeps = wu(newDeps)
          .filter(dep => !currentDeps.has(dep))
          // Skip edges to mergeCandidate to avoid self reference cycle
          .filter(dep => dep !== idToTry)
          .toArray()
        const filteredNewRevDeps = wu(newRevDeps)
          .filter(dep => !graph.get(dep).has(idToTry))
          // Skip edges to mergeCandidate to avoid self reference cycle
          .filter(dep => dep !== idToTry)
          .toArray()

        const candidateDeps = new Set(wu.chain(currentDeps, filteredNewDeps))
        const revCandidateDeps = filteredNewRevDeps.map(dep => [
          dep,
          new Set([...graph.get(dep), idToTry]),
        ] as [NodeId, Set<NodeId>])
        const graphChangeToTry = new Map([
          [idToTry, candidateDeps],
          ...revCandidateDeps,
        ])
        // Merging will not add new edges and therefore cannot create a cycle or
        // an explicit check for cycles
        if ((filteredNewDeps.length === 0 && filteredNewRevDeps.length === 0)
          || !graph.doesCreateCycle(graphChangeToTry, idToTry)) {
          // Safe to add the new edges and merge to candidate node
          filteredNewDeps.forEach(dep => graph.addEdge(idToTry, dep))
          filteredNewRevDeps.forEach(dep => graph.addEdge(dep, idToTry))
          return true
        }

        return false
      }

      const mergeCandidate = mergeCandidates.get(key)
      if (mergeCandidate && tryToAddToGroupID(mergeCandidate)) {
        return mergeCandidate
      }
      const groupId = _.uniqueId(`${key}-`)
      graph.addNode(groupId, [], { groupKey: key, items: new Map() })
      mergeCandidates.set(key, groupId)
      if (tryToAddToGroupID(groupId)) {
        return groupId
      }

      return undefined
    }

    return wu(source.keys())
      .reduce((result, nodeId) => {
        const inDeps = new Set(
          wu(source.get(nodeId))
            .map(depId => itemToGroupId.get(depId))
            .filter(values.isDefined)
        )
        const revDeps = new Set(
          wu(source.getReverse(nodeId))
            .map(depId => itemToGroupId.get(depId))
            .filter(values.isDefined)
        )
        const nodeGroupKey = groupKey(nodeId)
        const groupId = getOrCreateGroupNode(result, nodeGroupKey, inDeps, revDeps)
        if (groupId !== undefined) {
          // Add item to the group node (the dependencies are handled by getOrCreateGroupNode)
          result.getData(groupId).items.set(nodeId, source.getData(nodeId))
          itemToGroupId.set(nodeId, groupId)
          return result
        }
        throw new CircularDependencyError(source.getCycles())
      }, new DataNodeMap<Group<T>>())
  }, 'build grouped graph for %o nodes', source.size)
