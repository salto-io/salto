import Graph from '../src/dag'

describe('Graph', () => {
  describe('topologicalSort', () => {
    describe('for a simple graph', () => {
      const graph = new Graph<string>()
      graph.addNode('n2', 'n1')
      graph.addNode('n3', 'n2')
      graph.addNode('n4', 'n2')
      const res = graph.topologicalSort()

      it('should return the nodes in the correct order', () => {
        expect(res).toEqual(['n4', 'n3', 'n2', 'n1'])
      })
    })

    describe('for an empty graph', () => {
      const graph = new Graph<string>()
      const res = graph.topologicalSort()

      it('should return an empty array', () => {
        expect(res).toEqual([])
      })
    })
  })

  describe('removeRedundantEdges', () => {
    const graph = new Graph<string>()
    graph.addNode('n2', 'n1')
    graph.addNode('n3', 'n2')
    graph.addNode('n4', 'n2')
    graph.addNode('n3', 'n1')

    expect(graph.edges().length).toEqual(4)
    const originalTopologicalSortOrder = graph.topologicalSort()

    it('should remove the redundant edge', () => {
      graph.removeRedundantEdges()
      expect(graph.edges()).toEqual([['n2', 'n1'], ['n3', 'n2'], ['n4', 'n2']])
    })

    it('should not change the topological sort', () => {
      expect(graph.topologicalSort()).toEqual(originalTopologicalSortOrder)
    })
  })
})
