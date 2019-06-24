import wu from 'wu'

const updateSet = <T>(target: Set<T>, source: Iterable<T>): void => {
  wu(source).forEach(target.add.bind(target))
}

const deleteFromSet = <T>(target: Set<T>, source: Iterable<T>): void => {
  wu(source).forEach(target.delete.bind(target))
}

class DefaultMap<K, V> extends Map<K, V> {
  constructor(readonly initDefault: () => V, entries?: Iterable<[K, V]>) {
    super(wu(entries || []))
  }

  get(key: K): V {
    if (this.has(key)) {
      return super.get(key) as V
    }
    const res = this.initDefault()
    this.set(key, res)
    return res
  }
}

class NodeMap<T> extends DefaultMap<T, Set<T>> {
  constructor(entries?: Iterable<[T, Set<T>]>) {
    super(() => new Set<T>(), entries)
  }

  deleteValues(values: Iterable<T>): void {
    this.forEach(s => deleteFromSet(s, values))
  }

  deleteKeys(keys: Iterable<T>): void {
    wu(keys).forEach(this.delete.bind(this))
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

  private removeEdge(node: T, succ: T): void {
    this.successors.get(node).delete(succ)
    this.predecessors.get(succ).delete(node)
  }

  *topologicalSortIter(): IterableIterator<Set<T>> {
    // Copy the input so as to leave it unmodified
    const successors = this.successors.clone()

    while (true) {
      const nodesWithNoDeps = new Set<T>(
        wu(successors)
          .filter(([_item, succ]) => succ.size === 0)
          .map(([item]) => item)
      )

      if (nodesWithNoDeps.size === 0) {
        break
      }

      yield nodesWithNoDeps

      successors.deleteKeys(nodesWithNoDeps)
      successors.deleteValues(nodesWithNoDeps)
    }

    if (successors.size !== 0) {
      throw new CircularDependencyError(successors)
    }
  }

  topologicalSort(): T[][] {
    return [...this.topologicalSortIter()].map(s => [...s])
  }

  *topologicalSortFlatIter(): IterableIterator<T> {
    const iter = this.topologicalSortIter()[Symbol.iterator]()

    while (true) {
      const { done, value } = iter.next()
      if (done) {
        break
      }

      const itemsIter = value[Symbol.iterator]()

      while (true) {
        // eslint-disable-next-line no-shadow
        const { done, value } = itemsIter.next()
        if (done) {
          break
        }

        yield value
      }
    }
  }

  topologicalSortFlat(): T[] {
    return [...this.topologicalSortFlatIter()]
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

      this.successors
        .get(node)
        .forEach(succ => updateSet(indirectPredMap.get(succ), indirectPred))
    }

    this.topologicalSortFlat()
      .reverse()
      .forEach(removeDups)

    return this
  }
}
