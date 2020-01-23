import _ from 'lodash'
import wu from 'wu'
import { NodeId, DataNodeMap } from './nodemap'

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

export type DiffGraphTransformer<T> = (graph: DiffGraph<T>) => DiffGraph<T>

const getDiffNodeData = <T>(diff: DiffNode<T>): T => (
  diff.action === 'remove' ? diff.data.before : diff.data.after
)

type NodeEqualityFunc<T> = (node1: T, node2: T) => boolean
export const removeEqualNodes = <T>(equals: NodeEqualityFunc<T>): DiffGraphTransformer<T> => (
  graph => {
    const differentNodes = (ids: ReadonlyArray<NodeId>): boolean => {
      if (ids.length !== 2) {
        return true
      }
      const [node1, node2] = ids.map(id => getDiffNodeData(graph.getData(id)))
      return !equals(node1, node2)
    }

    const outputGraph = new DataNodeMap<DiffNode<T>>()
    _([...graph.keys()])
      .groupBy(id => graph.getData(id).originalId)
      .values()
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
    wu.chain(oldIds.map(id => target.get(id)))
      .flatten()
      // filter out old nodes from dependecy list
      .filter(id => !oldIds.includes(id))
  )

  // update reverse deps to new node
  oldIds.forEach(
    oldId => target.deleteNode(oldId).forEach(affected => target.get(affected).add(newId))
  )

  target.addNode(newId, deps, newData)
}

const tryCreateModificationNode = <T>(
  target: DiffGraph<T>,
  additionNodeId: NodeId,
  removalNodeId: NodeId,
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

export const mergeNodesToModify = <T>(target: DiffGraph<T>): DiffGraph<T> => {
  // Find all pairs of nodes pointing to the same original ID
  const mergeCandidates = _([...target.keys()])
    .groupBy(id => target.getData(id).originalId)
    .values()
    .filter(nodes => nodes.length === 2)
    .value()

  return mergeCandidates
    // Make sure the add node comes before the remove node
    .map(nodes => nodes.sort(node => (target.getData(node).action === 'add' ? -1 : 1)))
    .reduce(
      (graph, [add, remove]) => tryCreateModificationNode(graph, add, remove),
      target,
    )
}
