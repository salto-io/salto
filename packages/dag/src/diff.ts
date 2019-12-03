import _ from 'lodash'
import wu from 'wu'
import { collections } from '@salto/lowerdash'
import { logger } from '@salto/logging'
import { NodeId, DataNodeMap } from './nodemap'

const log = logger(module)

const { intersection, difference } = collections.set

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

export const buildDiffGraph = (() => {
  const addBeforeNodesAsRemovals = <T>(
    target: DiffGraph<T>,
    beforeNodeMap: DataNodeMap<T>
  ): Map<NodeId, DiffNodeId> => {
    const reverseBefore = beforeNodeMap.reverse()
    const removals = new Map<NodeId, DiffNodeId>()

    const addRemovalNode = (originalId: NodeId): DiffNodeId =>
      removals.get(originalId) || ((): DiffNodeId => {
        const diffNodeId = _.uniqueId()
        removals.set(originalId, diffNodeId)

        const diffNode: RemovalDiffNode<T> = {
          action: 'remove',
          originalId,
          data: { before: beforeNodeMap.getData(originalId) as T },
        }

        const deps = [...wu(reverseBefore.get(originalId)).map(oid => addRemovalNode(oid))]
        target.addNode(diffNodeId, deps, diffNode)
        return diffNodeId
      })()

    wu(beforeNodeMap.nodes()).forEach(addRemovalNode)

    return removals
  }

  const addAfterNodesAsAdditions = <T>(
    target: DiffGraph<T>,
    afterNodeMap: DataNodeMap<T>,
    removals: Map<NodeId, DiffNodeId>
  ): Map<NodeId, DiffNodeId> => {
    const additions = new Map<NodeId, DiffNodeId>()

    const calcDeps = (
      additionNodeFactory: (depId: NodeId) => DiffNodeId,
      originalId: NodeId,
    ): DiffNodeId[] => {
      const depNodeIds = [...wu(afterNodeMap.get(originalId)).map(additionNodeFactory)]
      const removeDiffNodeId = removals.get(originalId)
      if (removeDiffNodeId !== undefined) {
        depNodeIds.push(removeDiffNodeId)
      }
      return depNodeIds
    }

    const addAdditionNode = (originalId: NodeId): DiffNodeId =>
      additions.get(originalId) || ((): DiffNodeId => {
        const diffNodeId = _.uniqueId()

        additions.set(originalId, diffNodeId)

        const diffNode: AdditionDiffNode<T> = {
          action: 'add',
          originalId,
          data: { after: afterNodeMap.getData(originalId) },
        }

        const deps = calcDeps(addAdditionNode, originalId)
        target.addNode(diffNodeId, deps, diffNode)

        return diffNodeId
      })()

    wu(afterNodeMap.nodes()).forEach(addAdditionNode)

    return additions
  }

  const mergeNodes = <T>(
    target: DiffGraph<T>, oldIds: NodeId[], newId: NodeId, newData: DiffNode<T>
  ): void => {
    const deps = new Set<NodeId>(wu.chain(oldIds.map(id => target.get(id))).flatten())

    // delete old nodes
    oldIds.forEach(oldId => deps.delete(oldId))

    // update reverse deps to new node
    oldIds.forEach(
      oldId => target.deleteNode(oldId).forEach(affected => target.get(affected).add(newId))
    )

    target.addNode(newId, deps, newData)
  }

  const tryCreateModificationNode = <T>(
    target: DiffGraph<T>,
    removalNodeId: DiffNodeId,
    additionNodeId: DiffNodeId,
  ): DiffGraph<T> => {
    const removalNode = target.getData(removalNodeId) as RemovalDiffNode<T>
    const additionNode = target.getData(additionNodeId) as AdditionDiffNode<T>
    const { originalId } = removalNode

    const modificationNode: ModificationDiffNode<T> = {
      action: 'modify',
      originalId,
      data: {
        before: removalNode.data.before,
        after: additionNode.data.after,
      },
    }

    const modificationNodeId = _.uniqueId()

    return target.tryTransform(t => {
      mergeNodes(t, [removalNodeId, additionNodeId], modificationNodeId, modificationNode)
      return modificationNodeId
    })[0]
  }

  return <T>(
    before: DataNodeMap<T>,
    after: DataNodeMap<T>,
    equals: (id: NodeId) => boolean,
  ): DiffGraph<T> => log.time(() => {
    let result = new DataNodeMap<DiffNode<T>>()

    const removals = addBeforeNodesAsRemovals(result, before)
    const additions = addAfterNodesAsAdditions(result, after, removals)

    const removedAndAdded = intersection(removals.keys(), new Set<NodeId>(additions.keys()))
    const equalNodes = new Set<NodeId>(wu(removedAndAdded).filter(equals))

    const removalAndAdditionIds = (originalId: NodeId): [DiffNodeId, DiffNodeId] =>
      [removals, additions]
        .map(s => s.get(originalId) as DiffNodeId) as [DiffNodeId, DiffNodeId]

    // remove equal nodes
    const equalDiffNodeIds = new Set<DiffNodeId>(
      wu(equalNodes).map(removalAndAdditionIds).flatten(true)
    )
    result = result.cloneWithout(equalDiffNodeIds)

    const modifyCandidates = difference(removedAndAdded, equalNodes)

    // try to merge removals and additions for unequal nodes
    return wu(modifyCandidates).reduce(
      (res, originalId) => tryCreateModificationNode(res, ...removalAndAdditionIds(originalId)),
      result,
    )
  }, 'build diff graph for %o -> %o nodes', before.size, after.size)
})()
