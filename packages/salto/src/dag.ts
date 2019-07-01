import wu from 'wu'
import { update as updateSet } from './collections/set'
import { DefaultMap } from './collections/map'

const promiseAllToSingle = (promises: Iterable<Promise<void>>): Promise<void> =>
  Promise.all(promises).then(() => undefined)

export type AsyncNodeHandler<T> = (t: T) => Promise<void>
export type NodeHandler<T> = (t: T) => void
export type GraphNodeId = string | number

class NodeMap<T extends GraphNodeId> extends DefaultMap<T, Set<T>> {
  constructor(entries?: Iterable<[T, Set<T>]>) {
    super(() => new Set<T>(), entries)
  }

  clone(): NodeMap<T> {
    return new NodeMap<T>(wu(this).map(([k, v]) => [k, new Set<T>(v)]))
  }

  toString(): string {
    return `${wu(this)
      .map(([k, s]) => `${k}->${[...s]}`)
      .toArray()
      .join(', ')}`
  }
}

export class CircularDependencyError<T extends GraphNodeId> extends Error {
  constructor(data: NodeMap<T>) {
    super(`Circular dependencies exist among these items: ${data}`)
  }
}

// helper structure used for visiting/walking the graph in evaluation (aka topological) order
class DependencyMap<T extends GraphNodeId> extends NodeMap<T> {
  // returns nodes without dependencies - to be visited next in evaluation order
  nodesWithNoDependencies(source: Iterable<T>): Iterable<T> {
    return wu(source).filter(node => this.get(node).size === 0)
  }

  // deletes a node and returns the affected nodes (nodes that depend on the deleted node)
  deleteNode(node: T): Iterable<T> {
    this.delete(node)
    return wu(this)
      .filter(([_n, dep]) => dep.delete(node))
      .map(([affectedNode]) => affectedNode)
  }

  // used after walking the graph had finished - any undeleted nodes represent a cycle
  ensureEmpty(): void {
    if (this.size !== 0) {
      throw new CircularDependencyError(this)
    }
  }
}

export class DependencyGraph<T extends GraphNodeId> {
  private readonly dependencies = new NodeMap<T>()
  private readonly reverseDependencies = new NodeMap<T>()

  addNode(node: T, ...dependsOn: T[]): void {
    updateSet(this.dependencies.get(node), dependsOn)
    dependsOn.forEach(dependency => {
      this.addNode(dependency)
      this.reverseDependencies.get(dependency).add(node)
    })
  }

  getDependencies(node: T): Iterable<T> {
    return this.dependencies.has(node) ? [...this.dependencies.get(node)] : []
  }

  private removeEdge(node: T, dependsOn: T): void {
    this.dependencies.get(node).delete(dependsOn)
    this.reverseDependencies.get(dependsOn).delete(node)
  }

  edges(): [T, T][] {
    return [...this.edgesIter()]
  }

  edgesIter(): IterableIterator<[T, T]> {
    return wu(this.dependencies)
      .map(([node, dependencies]) => wu(dependencies).map(dependency => [node, dependency]))
      .flatten(true)
  }

  // taken from: https://stackoverflow.com/a/32242282
  removeRedundantEdges(): this {
    const indirectReverseDepMap = new NodeMap<T>()

    const removeDups = (node: T): void => {
      const indirectReverseDep = indirectReverseDepMap.get(node)
      const directReverseDep = [...this.reverseDependencies.get(node)]

      const dups = directReverseDep.filter(reverseDep => indirectReverseDep.has(reverseDep))

      dups.forEach(reverseDep => this.removeEdge(reverseDep, node))

      updateSet(indirectReverseDep, directReverseDep)

      this.dependencies.get(node)
        .forEach(dependency => updateSet(indirectReverseDepMap.get(dependency), indirectReverseDep))
    }

    [...this.evaluationOrder()]
      .reverse()
      .forEach(removeDups)

    return this
  }

  private newDependencyMap(): DependencyMap<T> {
    return new DependencyMap<T>(this.dependencies.clone())
  }

  *evaluationOrderGroups(): IterableIterator<Iterable<T>> {
    const dependencies = this.newDependencyMap()
    let nextNodes: Iterable<T> = dependencies.keys()

    while (true) {
      const freeNodes = [...dependencies.nodesWithNoDependencies(nextNodes)]
      const done = freeNodes.length === 0

      if (done) {
        dependencies.ensureEmpty()
        break
      }

      nextNodes = new Set<T>(wu(freeNodes).map(n => dependencies.deleteNode(n)).flatten())
      yield freeNodes
    }
  }

  evaluationOrder(): Iterable<T> {
    return wu(this.evaluationOrderGroups()).flatten()
  }

  async walk(handler: AsyncNodeHandler<T>): Promise<void> {
    const dependencies = this.newDependencyMap()

    const next = (affectedNodes: Iterable<T>): Promise<void> =>
      promiseAllToSingle(
        wu(dependencies.nodesWithNoDependencies(affectedNodes))
          .map(node => handler(node).then(() => next(dependencies.deleteNode(node))))
      )

    await next(dependencies.keys())

    dependencies.ensureEmpty()
  }

  walkSync(handler: NodeHandler<T>): void {
    const dependencies = this.newDependencyMap()

    const next = (affectedNodes: Iterable<T>): void => {
      wu(dependencies.nodesWithNoDependencies(affectedNodes))
        .forEach(node => {
          handler(node)
          next(dependencies.deleteNode(node))
        })
    }

    next(dependencies.keys())

    dependencies.ensureEmpty()
  }
}
