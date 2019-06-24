import { CircularDependencyError, Graph } from '../src/dag'

describe('Graph', () => {
  let graph: Graph<string>
  beforeEach(() => {
    graph = new Graph<string>()
  })

  describe('addNode', () => {
    describe('when adding nodes that do not exist', () => {
      beforeEach(() => graph.addNode('n1', 'n2', 'n3'))
      it('should add them', () => {
        expect(graph.edges()).toEqual([['n1', 'n2'], ['n1', 'n3']])
      })
    })

    describe('when adding a node without deps', () => {
      beforeEach(() => graph.addNode('n1'))
      it('should not create an edge', () => {
        expect(graph.edges().length).toEqual(0)
      })
    })
  })

  describe('topologicalSort', () => {
    describe('for a simple graph', () => {
      let res: string[][]

      beforeEach(() => {
        graph.addNode('n2', 'n1')
        graph.addNode('n3', 'n2')
        graph.addNode('n4', 'n2')
        res = graph.topologicalSort()
      })

      it('should return the nodes in the correct order', () => {
        expect(res).toEqual([['n1'], ['n2'], ['n3', 'n4']])
      })
    })

    describe('for an empty graph', () => {
      let res: string[][]

      beforeEach(() => {
        res = graph.topologicalSort()
      })

      it('should return an empty array', () => {
        expect(res).toEqual([])
      })
    })
  })

  describe('removeRedundantEdges', () => {
    let originalTopologicalSortOrder: string[][]

    beforeEach(() => {
      graph.addNode('n2', 'n1')
      graph.addNode('n3', 'n2')
      graph.addNode('n4', 'n2')
      graph.addNode('n3', 'n1')
      expect(graph.edges().length).toEqual(4)
      originalTopologicalSortOrder = graph.topologicalSort()
      graph.removeRedundantEdges()
    })

    it('should remove the redundant edge', () => {
      expect(graph.edges().length).toBe(3)
      expect(graph.edges()).toEqual([['n2', 'n1'], ['n3', 'n2'], ['n4', 'n2']])
    })

    it('should not change the topological sort', () => {
      expect(graph.topologicalSort()).toEqual(originalTopologicalSortOrder)
    })

    describe('when there is a circular dependency', () => {
      beforeEach(() => {
        graph.addNode('n1', 'n4')
      })

      it('throws an exception', () => {
        expect(() => graph.removeRedundantEdges()).toThrow(
          CircularDependencyError
        )
      })
    })
  })
})
