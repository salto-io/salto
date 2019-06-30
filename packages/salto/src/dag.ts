import wu from 'wu'
import { update as updateSet } from './collections/set'
import { DefaultMap } from './collections/map'

const promiseAllToSingle = (promises: Iterable<Promise<void>>): Promise<void> =>
  Promise.all(promises).then(() => undefined)

export type AsyncNodeHandler<T> = (t: T) => Promise<void>
export type NodeHandler<T> = (t: T) => void

export type DiffAction = 'add' | 'remove' | 'modify'

export interface DiffResult<T> {
  graph: Graph<T>
  actions: Map<T, DiffAction>
}

class NodeMap<T> extends DefaultMap<T, Set<T>> {
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

export class CircularDependencyError<T> extends Error {
  constructor(data: NodeMap<T>) {
    super(`Circular dependencies exist among these items: ${data}`)
  }
}

class SuccessorMap<T> extends NodeMap<T> {
  freeNodes(source: Iterable<T>): Iterable<T> {
    return wu(source).filter(node => this.get(node).size === 0)
  }

  // returns the affected successors
  deleteNode(node: T): Iterable<T> {
    this.delete(node)
    return wu(this)
      .filter(([_n, succ]) => succ.delete(node))
      .map(([affectedNode]) => affectedNode)
  }

  ensureEmpty(): void {
    if (this.size !== 0) {
      throw new CircularDependencyError(this)
    }
  }
}

export class Graph<T> {
  private readonly successors = new NodeMap<T>()
  private readonly predecessors = new NodeMap<T>()

  addNode(node: T, ...successors: T[]): void {
    updateSet(this.successors.get(node), successors)
    successors.forEach(successor => {
      this.addNode(successor)
      this.predecessors.get(successor).add(node)
    })
  }

  getSuccessors(node: T): Iterable<T> {
    return this.successors.has(node) ? [...this.successors.get(node)] : []
  }

  private removeEdge(node: T, succ: T): void {
    this.successors.get(node).delete(succ)
    this.predecessors.get(succ).delete(node)
  }

  edges(): [T, T][] {
    return [...this.edgesIter()]
  }

  *edgesIter(): IterableIterator<[T, T]> {
    const succIter = this.successors.entries()[Symbol.iterator]()

    while (true) {
      const { done, value } = succIter.next()
      if (done) {
        break
      }

      const [item, depsSet] = value

      const depsIter = depsSet[Symbol.iterator]()

      while (true) {
        // eslint-disable-next-line no-shadow
        const { done, value } = depsIter.next()
        if (done) {
          break
        }

        yield [item, value]
      }
    }
  }

  // taken from: https://stackoverflow.com/a/32242282
  removeRedundantEdges(): this {
    const indirectPredMap = new NodeMap<T>()

    const removeDups = (node: T): void => {
      const indirectPred = indirectPredMap.get(node)
      const directPred = [...this.predecessors.get(node)]

      const dups = directPred.filter(pred => indirectPred.has(pred))

      dups.forEach(pred => this.removeEdge(pred, node))

      updateSet(indirectPred, directPred)

      this.successors.get(node)
        .forEach(succ => updateSet(indirectPredMap.get(succ), indirectPred))
    }

    [...this.topologicalSort()]
      .reverse()
      .forEach(removeDups)

    return this
  }

  private newSuccessorMap(): SuccessorMap<T> {
    return new SuccessorMap<T>(this.successors.clone())
  }

  topologicalSortGroups(): Iterable<Iterable<T>> {
    const successors = this.newSuccessorMap()

    return {
      [Symbol.iterator](): Iterator<Iterable<T>> {
        let nextNodes: Iterable<T> = successors.keys()

        return {
          next(): IteratorResult<Iterable<T>> {
            const freeNodes = [...successors.freeNodes(nextNodes)]
            const done = freeNodes.length === 0

            if (done) {
              successors.ensureEmpty()
            } else {
              nextNodes = new Set<T>(wu(freeNodes).map(n => successors.deleteNode(n)).flatten())
            }

            return { done, value: freeNodes }
          },
        }
      },
    }
  }

  topologicalSort(): Iterable<T> {
    return wu(this.topologicalSortGroups()).flatten()
  }

  async walk(handler: AsyncNodeHandler<T>): Promise<void> {
    const successors = this.newSuccessorMap()

    const next = (affectedSuccessors: Iterable<T>): Promise<void> =>
      promiseAllToSingle(
        wu(successors.freeNodes(affectedSuccessors))
          .map(node => handler(node).then(() => next(successors.deleteNode(node))))
      )

    await next(successors.keys())

    successors.ensureEmpty()
  }

  walkSync(handler: NodeHandler<T>): void {
    const successors = this.newSuccessorMap()

    const next = (affectedSuccessors: Iterable<T>): void => {
      wu(successors.freeNodes(affectedSuccessors))
        .forEach(node => {
          handler(node)
          next(successors.deleteNode(node))
        })
    }

    next(successors.keys())

    successors.ensureEmpty()
  }

  diff(other: Graph<T>, equals: (node: T) => boolean): DiffResult<T> {
    const actions = new Map<T, DiffAction>()

    const before = this
    const after = other
    const result = new Graph<T>()

    const allNodes = new Set<T>([...before.successors.keys(), ...after.successors.keys()])

    allNodes.forEach(node => {
      if (before.successors.has(node) && !after.successors.has(node)) {
        result.addNode(node, ...before.successors.get(node))
        actions.set(node, 'remove')
      } else if (!before.successors.has(node) && after.successors.has(node)) {
        result.addNode(node, ...after.successors.get(node))
        actions.set(node, 'add')
      } else {
        result.addNode(node, ...[...before.successors.get(node), ...after.successors.get(node)])
        if (!equals(node)) {
          actions.set(node, 'modify')
        }
      }
    })

    return { graph: result, actions }
  }
}
