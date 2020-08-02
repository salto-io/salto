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
import { collections } from '@salto-io/lowerdash'

const { difference } = collections.set

export type NodeId = collections.set.SetId

export class CircularDependencyError extends Error {
  public readonly causingNodeIds: NodeId[]

  constructor(nodes: AbstractNodeMap) {
    super(`Circular dependencies exist among these items: ${nodes}`)
    this.causingNodeIds = [...nodes.keys()]
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

class WalkErrors extends Map<NodeId, Error> {
  constructor(readonly nodeMap: AbstractNodeMap) {
    super()
  }

  set(nodeId: NodeId, value: Error): this {
    super.set(nodeId, value)
    this.nodeMap.getReverse(nodeId).forEach(
      dependentNode => this.set(dependentNode, new NodeSkippedError(nodeId))
    )
    return this
  }

  throwIfNotEmpty(): void {
    const errorNodes = new Set(this.keys())
    const unhandledNodes = difference(this.nodeMap.keys(), errorNodes)

    if (this.size !== 0 || unhandledNodes.size !== 0) {
      throw new WalkError(
        this,
        unhandledNodes.size !== 0
          ? new CircularDependencyError(this.nodeMap.cloneWithout(errorNodes))
          : undefined,
      )
    }
  }
}

// Basic dependency map: nodeId => dependsOnNodeId[]
// Does not store data other than IDs.
// Includes logic to walk the graph in evaluation order, while removing each processed node.
export class AbstractNodeMap extends collections.map.DefaultMap<NodeId, Set<NodeId>> {
  private reverseNeighbors: collections.map.DefaultMap<NodeId, Set<NodeId>>

  constructor(entries?: Iterable<[NodeId, Set<NodeId>]>) {
    const defaultInit = (): Set<NodeId> => new Set<NodeId>()
    super(defaultInit, entries)
    this.reverseNeighbors = new collections.map.DefaultMap(defaultInit)
    wu(this).forEach(([id, deps]) => {
      deps.forEach(dep => this.reverseNeighbors.get(dep).add(id))
    })
  }

  clone(): this {
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

  protected addNodeBase(id: NodeId, dependsOn: Iterable<NodeId>): void {
    wu(dependsOn).forEach(dep => this.addEdge(id, dep))
    // ensure node is created even if there are no dependencies
    this.get(id)
  }

  getReverse(id: NodeId): Set<NodeId> {
    return this.reverseNeighbors.has(id)
      ? this.reverseNeighbors.get(id)
      : new Set()
  }

  // returns nodes without dependencies - to be visited next in evaluation order
  freeNodes(source: Iterable<NodeId>): Iterable<NodeId> {
    return wu(source).filter(id => this.isFreeNode(id))
  }

  isFreeNode(id: NodeId): boolean {
    return this.get(id).size === 0
  }

  // deletes a node and returns the affected nodes (nodes that depend on the deleted node)
  deleteNode(id: NodeId): Set<NodeId> {
    const outgoingNeighbors = this.get(id)
    const incomingNeighbors = this.reverseNeighbors.get(id)
    // Remove all edges that relate to the deleted node
    incomingNeighbors.forEach(n => this.get(n).delete(id))
    outgoingNeighbors.forEach(n => this.reverseNeighbors.get(n).delete(id))
    // Remove deleted node
    this.delete(id)
    this.reverseNeighbors.delete(id)
    return incomingNeighbors
  }

  protected entriesWithout(ids: Set<NodeId>): Iterable<[NodeId, Set<NodeId>]> {
    return wu(this)
      .filter(([k]) => !ids.has(k))
      .map(([k, v]) => [k, difference(v, ids)])
  }

  // bulk alternative to deleteNode which returns a new NodeMap without the specified nodes
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
    if (!this.has(id)) {
      // Avoid creating a node as a side effect of removing an edge
      return
    }
    this.get(id).delete(dependsOn)
    this.reverseNeighbors.get(dependsOn).delete(id)
  }

  addEdge(from: NodeId, to: NodeId): void {
    this.get(from).add(to)
    this.reverseNeighbors.get(to).add(from)
    // create "to" node if missing
    this.get(to)
  }

  clearEdges(): void {
    // Clear only values, we need to maintain the keys
    this.forEach(deps => deps.clear())
    this.reverseNeighbors.clear()
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
    const errors = new WalkErrors(this)

    const next = (affectedNodes: Iterable<NodeId>): Promise<void> => promiseAllToSingle(
      wu(this.freeNodes(affectedNodes)).map(
        node => handler(node).then(
          () => next(this.deleteNode(node)),
          e => { errors.set(node, e) },
        )
      )
    )

    await next(this.keys())
    errors.throwIfNotEmpty()
  }

  async walkAsync(handler: AsyncNodeHandler): Promise<void> {
    return this.clone().walkAsyncDestructive(handler)
  }

  private walkSyncDestructive(handler: NodeHandler): void {
    const errors = new WalkErrors(this)

    const next = (affectedNodes: Iterable<NodeId>): void => {
      wu(this.freeNodes(affectedNodes))
        .forEach(node => {
          try {
            handler(node)
            next(this.deleteNode(node))
          } catch (e) {
            errors.set(node, e)
          }
        })
    }

    next(this.keys())
    errors.throwIfNotEmpty()
  }

  walkSync(handler: NodeHandler): void {
    return this.clone().walkSyncDestructive(handler)
  }

  doesCreateCycle(changes: Map<NodeId, Set<NodeId>>, findCycleFrom: NodeId): boolean {
    const setMany = (newEdges: Map<NodeId, Set<NodeId>>): void => {
      // Note we use "this.set" for efficiency. this is safe to do because we revert
      // all changes at the end, so this does not break the reverseEdges map
      wu(newEdges.entries()).forEach(([id, deps]) => { this.set(id, deps) })
    }
    const origEdges = new Map(wu(changes.keys()).map(id => [id, this.get(id)]))
    setMany(changes)
    const createsCycle = this.hasCycle(findCycleFrom)
    setMany(origEdges)
    return createsCycle
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

  deleteNode(id: NodeId): Set<NodeId> {
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
