import wu from 'wu'
import { SetId, update as updateSet, intersection } from './set'
import { DefaultMap } from './map'

export type NodeId = SetId

export class CircularDependencyError extends Error {
  constructor(nodes: NodeMap) {
    super(`Circular dependencies exist among these items: ${nodes}`)
  }
}

export type AsyncNodeHandler = (id: NodeId) => Promise<void>
export type NodeHandler = (id: NodeId) => void

const promiseAllToSingle = (promises: Iterable<Promise<void>>): Promise<void> =>
  Promise.all(promises).then(() => undefined)

// Basic dependency map: nodeId => dependsOnNodeId[]
// Does not store data other than IDs.
// Includes logic to walk the graph in evaluation order, while removing each processed node.
export class NodeMap
  extends DefaultMap<NodeId, Set<NodeId>> {
  constructor(entries?: Iterable<[NodeId, Set<NodeId>]>) {
    const defaultInit = (): Set<NodeId> => new Set<NodeId>()
    super(defaultInit, entries)
  }

  clone(): this {
    // https://stackoverflow.com/a/42347824
    return new (this.constructor as new(entries: Iterable<[NodeId, Set<NodeId>]>) => this)(
      wu(this).map(([k, v]) => [k, new Set<NodeId>(v)])
    )
  }

  toString(): string {
    return `${wu(this)
      .map(([k, s]) => `${k}->[${[...s]}]`)
      .toArray()
      .join(', ')}`
  }

  nodes(): Set<NodeId> {
    return new Set<NodeId>(wu.chain(this.keys(), wu(this.values()).flatten(true)))
  }

  addNode(id: NodeId, dependsOn: Iterable<NodeId> = []): void {
    updateSet(this.get(id), dependsOn)
    wu(dependsOn).forEach(dependency => {
      this.addNode(dependency)
    })
  }

  // returns nodes without dependencies - to be visited next in evaluation order
  freeNodes(source: Iterable<NodeId>): Iterable<NodeId> {
    return wu(source).filter(id => this.isFreeNode(id))
  }

  isFreeNode(id: NodeId): boolean {
    return this.get(id).size === 0
  }

  // deletes a node and returns the affected nodes (nodes that depend on the deleted node)
  deleteNode(id: NodeId): NodeId[] {
    this.delete(id)
    return wu(this)
      .filter(([_n, deps]) => deps.delete(id))
      .map(([affectedNode]) => affectedNode)
      // evaluate the iterator, so deps will be deleted even if the return value is disregarded
      .toArray()
  }

  // used after walking the graph had finished - any undeleted nodes represent a cycle
  ensureEmpty(): void {
    if (this.size !== 0) {
      throw new CircularDependencyError(this)
    }
  }

  removeEdge(id: NodeId, dependsOn: NodeId): void {
    this.get(id).delete(dependsOn)
  }

  edges(): [NodeId, NodeId][] {
    return [...this.edgesIter()]
  }

  edgesIter(): IterableIterator<[NodeId, NodeId]> {
    return wu(this)
      .map(([node, dependencies]) => wu(dependencies).map(dependency => [node, dependency]))
      .flatten(true)
  }

  hasCycle(from: NodeId, visited: Set<NodeId> = new Set<NodeId>()): boolean {
    if (visited.has(from)) {
      return true
    }

    visited.add(from)

    return wu(this.get(from)).some(d => this.hasCycle(d, new Set<NodeId>(visited)))
  }

  *evaluationOrderGroups(): IterableIterator<Iterable<NodeId>> {
    const dependencies = this.clone()
    let nextNodes: Iterable<NodeId> = dependencies.keys()

    while (true) {
      const freeNodes = [...dependencies.freeNodes(nextNodes)]
      const done = freeNodes.length === 0

      if (done) {
        dependencies.ensureEmpty()
        break
      }

      nextNodes = new Set<NodeId>(wu(freeNodes).map(n => dependencies.deleteNode(n)).flatten())

      yield freeNodes
    }
  }

  evaluationOrder(): Iterable<NodeId> {
    return wu(this.evaluationOrderGroups()).flatten()
  }

  async walk(handler: AsyncNodeHandler): Promise<void> {
    const dependencies = this.clone()

    const next = (affectedNodes: Iterable<NodeId>): Promise<void> =>
      promiseAllToSingle(
        wu(dependencies.freeNodes(affectedNodes)).map(node =>
          handler(node).then(() => next(dependencies.deleteNode(node))))
      )

    await next(dependencies.keys())

    dependencies.ensureEmpty()
  }

  walkSync(handler: NodeHandler): void {
    const dependencies = this.clone()

    const next = (affectedNodes: Iterable<NodeId>): void => {
      wu(dependencies.freeNodes(affectedNodes))
        .forEach(id => {
          handler(id)
          next(dependencies.deleteNode(id))
        })
    }

    next(dependencies.keys())

    dependencies.ensureEmpty()
  }

  tryTransform(transform: (nodeMap: this) => NodeId, callbacks?: {onSuccess?: () => void
    onError?: () => void}): this {
    const transformed = this.clone()
    const affectedNodeId = transform(transformed)

    if (transformed.hasCycle(affectedNodeId)) {
      if (callbacks && callbacks.onError) callbacks.onError()
      return this
    }
    if (callbacks && callbacks.onSuccess) callbacks.onSuccess()
    return transformed
  }

  reverse(): this {
    const result = new (this.constructor as new() => this)()
    wu(this.entries()).forEach(([id, deps]) => {
      deps.forEach(d => result.addNode(d, [id]))
    })
    return result
  }

  // taken from: https://stackoverflow.com/a/32242282
  removeRedundantEdges(): this {
    const indirectReverseDepMap = new NodeMap()
    const reverse = this.reverse()

    const removeDups = (id: NodeId): void => {
      const indirectReverseDep = indirectReverseDepMap.get(id)
      const directReverseDep = reverse.get(id)

      const dups = intersection(directReverseDep, indirectReverseDep)

      dups.forEach(reverseDep => this.removeEdge(reverseDep, id))

      updateSet(indirectReverseDep, directReverseDep)

      this.get(id).forEach(
        dependency => updateSet(indirectReverseDepMap.get(dependency), indirectReverseDep)
      )
    }

    wu(reverse.evaluationOrder()).forEach(removeDups)

    return this
  }
}

// This class adds storage of node data to NodeMap
export class DataNodeMap<T> extends NodeMap {
  protected readonly nodeData = new Map<NodeId, T>()

  addNode(id: NodeId, dependsOn: Iterable<NodeId> = [], data?: T): void {
    super.addNode(id, dependsOn)
    if (data !== undefined) {
      this.nodeData.set(id, data)
    }
  }

  deleteNode(id: NodeId): NodeId[] {
    this.nodeData.delete(id)
    return super.deleteNode(id)
  }

  getData(id: NodeId): T | undefined {
    return this.nodeData.get(id)
  }

  setData(id: NodeId, data: T): void {
    this.nodeData.set(id, data)
  }

  reverse(): this {
    return super.reverse().setDataFrom(this)
  }

  clear(): void {
    super.clear()
    this.nodeData.clear()
  }

  private setDataFrom(source: this): this {
    wu(source.nodeData).forEach(([id, data]) => this.nodeData.set(id, data))
    return this
  }

  clone(): this {
    return super.clone().setDataFrom(this)
  }
}
