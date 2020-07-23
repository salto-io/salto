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
import _ from 'lodash'
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import { NodeId, DataNodeMap } from './nodemap'

const { iterable } = collections

export type DiffNodeId = string

interface BaseDiffNode {originalId: NodeId}

export type ActionName = 'add' | 'remove' | 'modify'

interface Diff {
  action: ActionName
}

export interface AdditionDiff<T> extends Diff {
  action: 'add'
  data: { after: T }
}
type AdditionDiffNode<T> = BaseDiffNode & AdditionDiff<T>

export interface RemovalDiff<T> extends Diff {
  action: 'remove'
  data: { before: T }
}
type RemovalDiffNode<T> = BaseDiffNode & RemovalDiff<T>

export interface ModificationDiff<T> extends Diff {
  action: 'modify'
  data: { before: T; after: T }
}
type ModificationDiffNode<T> = BaseDiffNode & ModificationDiff<T>

export type DiffNode<T> = AdditionDiffNode<T> | RemovalDiffNode<T> | ModificationDiffNode<T>

export type DiffGraph<T> = DataNodeMap<DiffNode<T>>

export type DiffGraphTransformer<T> = (graph: DiffGraph<T>) => Promise<DiffGraph<T>>

const getDiffNodeData = <T>(diff: DiffNode<T>): T => (
  diff.action === 'remove' ? diff.data.before : diff.data.after
)

type NodeEqualityFunc<T> = (node1: T, node2: T) => boolean
export const removeEqualNodes = <T>(equals: NodeEqualityFunc<T>): DiffGraphTransformer<T> => (
  async graph => {
    const differentNodes = (ids: ReadonlyArray<NodeId>): boolean => {
      if (ids.length !== 2) {
        return true
      }
      const [node1, node2] = ids.map(id => getDiffNodeData(graph.getData(id)))
      return !equals(node1, node2)
    }

    const outputGraph = new DataNodeMap<DiffNode<T>>()
    wu(iterable.groupBy(graph.keys(), id => graph.getData(id).originalId).values())
      .filter(differentNodes)
      .flatten()
      .forEach(id => { outputGraph.addNode(id, [], graph.getData(id)) })
    return outputGraph
  }
)

const mergeNodes = <T>(
  target: DiffGraph<T>, oldIds: NodeId[], newId: NodeId, newData: DiffNode<T>
): void => {
  const deps = new Set<NodeId>(
    wu.chain(...oldIds.map(id => target.get(id)))
      // filter out old nodes from dependency list
      .filter(id => !oldIds.includes(id))
  )

  target.addNode(newId, deps, newData)

  // update reverse deps to new node
  oldIds.forEach(id => {
    target.deleteNode(id).forEach(affected => target.addEdge(affected, newId))
  })
}

const tryCreateModificationNode = <T>(
  target: DiffGraph<T>,
  additionNodeId: NodeId,
  removalNodeId: NodeId,
): DiffGraph<T> => {
  const edgeCausesCycle = (from: NodeId, to: NodeId): boolean => {
    const fromDeps = target.get(from)
    // no modification required, this is already checked
    if (fromDeps.has(to)) return false
    const toDeps = target.get(to)
    const newEdges = new Map([
      [from, new Set([...fromDeps, to])],
      // Remove edge in the reverse direction to avoid a false positive cycle
      [to, new Set(wu(toDeps).filter(dep => dep !== from))],
    ])
    return target.doesCreateCycle(newEdges, from)
  }
  // for cycle detection, merging the nodes is equivalent to adding edges in both directions
  // (obviously not at the same time, because that would create a cycle)
  if (edgeCausesCycle(additionNodeId, removalNodeId)
      || edgeCausesCycle(removalNodeId, additionNodeId)) {
    return target
  }

  const removalNode = target.getData(removalNodeId) as RemovalDiffNode<T>
  const additionNode = target.getData(additionNodeId) as AdditionDiffNode<T>
  const { originalId } = removalNode

  const modificationNodeId = _.uniqueId()
  const modificationNode: ModificationDiffNode<T> = {
    action: 'modify',
    originalId,
    data: {
      before: removalNode.data.before,
      after: additionNode.data.after,
    },
  }

  mergeNodes(target, [removalNodeId, additionNodeId], modificationNodeId, modificationNode)
  return target
}

type Pair<T> = [T, T]
const isPair = <T>(items: ReadonlyArray<T>): items is Pair<T> => (
  items.length === 2
)
type SetIdPair = Pair<collections.set.SetId>

export const mergeNodesToModify = <T>(target: DiffGraph<T>): void => {
  const addBeforeRemove = (nodes: SetIdPair): SetIdPair => {
    const [adds, removes] = _.partition(nodes, node => target.getData(node).action === 'add')
    return [adds[0], removes[0]]
  }

  // Find all pairs of nodes pointing to the same original ID
  const mergeCandidates = wu(
    iterable.groupBy(target.keys(), id => target.getData(id).originalId).values()
  ).filter(isPair)

  mergeCandidates
    .map(addBeforeRemove)
    .reduce(
      (graph, [add, remove]) => tryCreateModificationNode(graph, add, remove),
      target,
    )
}
