import { topologicalSort, DiGraph } from 'jsnetworkx'
import wu from 'wu'

const updateSet = <T>(target: Set<T>, source: Iterable<T>): void => {
  wu(source).forEach((v: T) => {
    target.add(v)
  })
}

class DefaultMap<K, V> extends Map<K, V> {
  constructor(
    readonly initDefault: () => V,
    entries?: ReadonlyArray<readonly [K, V]>
  ) {
    super(entries)
  }

  get(key: K): V {
    if (this.has(key)) {
      return super.get(key) as V
    }
    const res = this.initDefault()
    super.set(key, res)
    return res
  }
}

export default class Graph<T> {
  private readonly impl = new DiGraph(undefined, undefined)

  addNode(node: T, ...dependents: T[]): void {
    const graph = this.impl
    graph.addNode(node)
    dependents.forEach((dep: T) => graph.addEdge(node, dep))
  }

  topologicalSort(): Iterable<T> {
    return topologicalSort(this.impl, undefined)
  }

  edges(): [T, T][] {
    return this.impl.outEdges(undefined, undefined)
  }

  // taken from: https://stackoverflow.com/a/32242282
  removeRedundantEdges(): Graph<T> {
    const indirectPredMap = new DefaultMap<T, Set<T>>(() => new Set<T>())

    const graph = this.impl

    topologicalSort(graph, undefined).forEach((node: T) => {
      const indirectPred = indirectPredMap.get(node)
      const directPred = graph.predecessors(node) as Array<T>

      directPred
        .filter(pred => indirectPred.has(pred))
        .forEach(pred => graph.removeEdge(pred, node))

      updateSet(indirectPred, directPred)

      const successors = graph.successors(node) as T[]

      successors.forEach((succ: T) => {
        updateSet(indirectPredMap.get(succ), indirectPred)
      })
    })

    return this
  }
}
