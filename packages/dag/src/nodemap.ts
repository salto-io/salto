import wu from 'wu'
import { collections } from '@salto/lowerdash'

const { update: updateSet, intersection, difference } = collections.set

export type NodeId = collections.set.SetId

export class CircularDependencyError extends Error {
  public readonly causingNodeIds: NodeId[]

  constructor(nodes: AbstractNodeMap) {
    super(`Circular dependencies exist among these items: ${nodes}`)
    this.causingNodeIds = wu(nodes.nodes().keys()).toArray()
  }
}

export class NodeSkippedError extends Error {
  public readonly causingNode: NodeId

  constructor(causingNode: NodeId) {
    super(`Skipped due to an error in parent node ${causingNode}`)
    this.causingNode = causingNode
  }
}

export class WalkError extends Error {
  readonly handlerErrors: ReadonlyMap<NodeId, Error>
  readonly circularDependencyError?: CircularDependencyError

  constructor(
    handlerErrors: ReadonlyMap<NodeId, Error>,
    circularDependencyError?: CircularDependencyError
  ) {
    super([
      'At least one error encountered during walk:',
      circularDependencyError?.toString(),
      WalkError.formatErrors(handlerErrors),
    ].filter(s => s).join('\n'))
    this.handlerErrors = handlerErrors
    this.circularDependencyError = circularDependencyError
  }

  static formatErrors(errors: Iterable<[NodeId, Error]>, indent = 2): string {
    const indentStr = Array(indent).fill(' ').join('')
    return wu(errors)
      .map(([node, error]) => `${indentStr}${node}: ${error}`)
      .toArray().join('\n')
  }
}

export type AsyncNodeHandler = (id: NodeId) => Promise<void>
export type NodeHandler = (id: NodeId) => void

const promiseAllToSingle = (promises: Iterable<Promise<void>>): Promise<void> =>
  Promise.all(promises).then(() => undefined)

// Basic dependency map: nodeId => dependsOnNodeId[]
// Does not store data other than IDs.
// Includes logic to walk the graph in evaluation order, while removing each processed node.
export class AbstractNodeMap extends collections.map.DefaultMap<NodeId, Set<NodeId>> {
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

  protected addNodeBase(id: NodeId, dependsOn: Iterable<NodeId> = []): void {
    updateSet(this.get(id), dependsOn)
    wu(dependsOn).forEach(dependency => {
      this.addNodeBase(dependency)
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

  protected entriesWithout(ids: Set<NodeId>): Iterable<[NodeId, Set<NodeId>]> {
    return wu(this)
      .filter(([k]) => !ids.has(k))
      .map(([k, v]) => [k, difference(v, ids)])
  }

  // faster bulk alternative to deleteNode which returns a new NodeMap without the specified nodes
  cloneWithout(ids: Set<NodeId>): this {
    return new (this.constructor as new (entries: Iterable<[NodeId, Set<NodeId>]>) => this)(
      this.entriesWithout(ids)
    )
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

  async walkAsyncDestructive(handler: AsyncNodeHandler): Promise<void> {
    const errors = new Map<NodeId, Error>()
    let reverse: this // lazy load

    const next = (affectedNodes: Iterable<NodeId>): Promise<void> => promiseAllToSingle(
      wu(this.freeNodes(affectedNodes)).map(
        node => handler(node).then(
          () => next(this.deleteNode(node)),
          e => {
            if (!reverse) {
              reverse = this.reverse()
            }
            this.setError(node, e, errors, reverse)
          },
        )
      )
    )

    await next(this.keys())

    this.throwWalkErrors(errors)
  }

  async walkAsync(handler: AsyncNodeHandler): Promise<void> {
    return this.clone().walkAsyncDestructive(handler)
  }

  private walkSyncDestructive(handler: NodeHandler): void {
    const errors = new Map<NodeId, Error>()
    let reverse: this // lazy load

    const next = (affectedNodes: Iterable<NodeId>): void => {
      wu(this.freeNodes(affectedNodes))
        .forEach(node => {
          try {
            handler(node)
            next(this.deleteNode(node))
          } catch (e) {
            if (!reverse) {
              reverse = this.reverse()
            }
            this.setError(node, e, errors, reverse)
          }
        })
    }

    next(this.keys())
    this.throwWalkErrors(errors)
  }

  walkSync(handler: NodeHandler): void {
    return this.clone().walkSyncDestructive(handler)
  }

  private setError(node: NodeId, error: Error, errors: Map<NodeId, Error>, reverse: this): void {
    errors.set(node, error)
    reverse.get(node).forEach(
      dependentNode => this.setError(dependentNode, new NodeSkippedError(node), errors, reverse)
    )
  }

  private throwWalkErrors(errors: Map<NodeId, Error>): void {
    const errorNodes = new Set(errors.keys())
    const unhandledNodes = difference(this.keys(), errorNodes)

    if (errors.size !== 0 || unhandledNodes.size !== 0) {
      throw new WalkError(
        errors,
        unhandledNodes.size !== 0
          ? new CircularDependencyError(this.cloneWithout(errorNodes))
          : undefined,
      )
    }
  }

  tryTransform(transform: (nodeMap: this) => NodeId): [this, boolean] {
    const transformed = this.clone()
    const affectedNodeId = transform(transformed)
    const hasCycles = transformed.hasCycle(affectedNodeId)
    const result = hasCycles ? this : transformed
    return [result, !hasCycles]
  }

  reverse(): this {
    const result = new (this.constructor as new() => this)()
    wu(this.entries()).forEach(([id, deps]) => {
      deps.forEach(d => result.addNodeBase(d, [id]))
    })
    return result
  }

  // taken from: https://stackoverflow.com/a/32242282
  removeRedundantEdges(): this {
    const indirectReverseDepMap = new AbstractNodeMap()
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

export class NodeMap extends AbstractNodeMap {
  addNode(id: NodeId, dependsOn: Iterable<NodeId> = []): void {
    return super.addNodeBase(id, dependsOn)
  }
}

// This class adds storage of node data to NodeMap
export class DataNodeMap<T> extends AbstractNodeMap {
  protected readonly nodeData: Map<NodeId, T>

  constructor(
    entries?: Iterable<[NodeId, Set<NodeId>]>,
    nodeData?: Map<NodeId, T>,
  ) {
    super(entries)
    this.nodeData = nodeData || new Map<NodeId, T>()
  }

  addNode(id: NodeId, dependsOn: Iterable<NodeId>, data: T): void {
    super.addNodeBase(id, dependsOn)
    this.nodeData.set(id, data)
  }

  deleteNode(id: NodeId): NodeId[] {
    this.nodeData.delete(id)
    return super.deleteNode(id)
  }

  cloneWithout(ids: Set<NodeId>): this {
    return new (this.constructor as new (
      entries: Iterable<[NodeId, Set<NodeId>]>,
      nodeData: Map<NodeId, T>,
    ) => this)(
      this.entriesWithout(ids),
      new Map<NodeId, T>(wu(this.nodeData).filter(([k]) => !ids.has(k))),
    )
  }

  getData(id: NodeId): T {
    const result = this.nodeData.get(id)
    if (result === undefined) {
      const reason = this.has(id) ? 'Node has no data' : 'Node does not exist'
      throw new Error(`Cannot get data of "${id}": ${reason}`)
    }
    return this.nodeData.get(id) as T
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
    wu(source.nodeData).forEach(([id, data]) => this.setData(id, data))
    return this
  }

  clone(): this {
    return super.clone().setDataFrom(this)
  }
}
