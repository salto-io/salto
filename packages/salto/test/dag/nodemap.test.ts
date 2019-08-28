import wu from 'wu'
import _ from 'lodash'
import {
  NodeMap, NodeId, CircularDependencyError, DataNodeMap,
} from '../../src/dag/nodemap'

class MaxCounter {
  private current = 0
  private max = 0

  increment(): void {
    this.current += 1
    if (this.current > this.max) {
      this.max = this.current
    }
  }

  decrement(): void {
    this.current -= 1
  }

  get maximum(): number {
    return this.max
  }
}

describe('NodeMap', () => {
  let subject: NodeMap

  beforeEach(() => {
    subject = new NodeMap()
  })

  describe('constructor', () => {
    describe('when no args are specified', () => {
      it('should create an empty map', () => {
        expect([...subject.keys()]).toEqual([])
      })
    })

    describe('when args are specified', () => {
      const s1 = new Set([1, 2, 3])
      const s2 = new Set([3, 4])

      beforeEach(() => {
        subject = new NodeMap([
          [1, s1],
          [2, s2],
        ])
      })

      it('should not copy specified sets', () => {
        expect(subject.get(1)).toBe(s1)
        expect(subject.get(2)).toBe(s2)
      })

      it('should contain the given keys', () => {
        expect(subject.keys()).toContain(1)
        expect(subject.keys()).toContain(2)
      })
    })
  })

  describe('clone', () => {
    let clone: NodeMap

    beforeEach(() => {
      subject = new NodeMap([
        [1, new Set<NodeId>([2, 3])],
        [2, new Set<NodeId>([3, 4])],
      ])
      clone = subject.clone()
    })

    it('should create an equal copy of itself', () => {
      expect(clone).not.toBe(subject)
      expect(clone).toEqual(subject)
    })

    it('should create a copy of the dep sets', () => {
      expect(clone.get(1)).toEqual(subject.get(1))
      expect(clone.get(1)).not.toBe(subject.get(1))

      expect(clone.get(2)).toEqual(subject.get(2))
      expect(clone.get(2)).not.toBe(subject.get(2))
    })
  })

  describe('keys and has', () => {
    beforeEach(() => {
      subject = new NodeMap([
        [1, new Set()],
        [1, new Set()],
      ])
    })

    describe('keys', () => {
      it('should contain the key', () => {
        expect([...subject.keys()]).toEqual([1])
      })
    })

    describe('has', () => {
      it('should return true for an existing key', () => {
        expect(subject.has(1)).toBe(true)
      })

      it('should return false for non-existing key', () => {
        expect(subject.has(2)).toBe(false)
        expect(subject.has('1')).toBe(false)
      })
    })
  })

  describe('nodes', () => {
    beforeEach(() => {
      subject = new NodeMap([
        [1, new Set<number>([2])],
      ])
    })

    it('should include the free dependent nodes', () => {
      expect(subject.nodes()).toContain(2)
    })
  })

  describe('get', () => {
    describe('when a node exists and has successors', () => {
      beforeEach(() => {
        subject = new NodeMap([
          [1, new Set<NodeId>([2, 3])],
        ])
      })

      it('should return them', () => {
        expect(subject.get(1)).toEqual(new Set<NodeId>([2, 3]))
      })
    })

    describe('when a node exists and has no successors', () => {
      beforeEach(() => {
        subject = new NodeMap([
          [1, new Set<NodeId>([2])],
        ])
      })

      it('should return an empty iterator', () => {
        expect([...subject.get(2)]).toEqual([])
      })
    })

    describe('when a node does not exist', () => {
      beforeEach(() => {
        subject = new NodeMap([
          [1, new Set<NodeId>([2])],
        ])
      })

      it('should return an empty iterator', () => {
        expect([...subject.get(3)]).toEqual([])
      })

      it('should not add it to the graph', () => {
        expect(subject.edges()).toEqual([[1, 2]])
      })
    })
  })

  describe('addNode', () => {
    beforeEach(() => {
      subject = new NodeMap([
        [1, new Set<NodeId>([2, 3])],
      ])
    })

    describe('when adding a non-existing node with no dependencies', () => {
      beforeEach(() => {
        subject.addNode(12)
      })

      it('should add the node to the keys', () => {
        expect(subject.keys()).toContain(12)
      })

      it('should not create an edge', () => {
        expect(subject.edges().length).toEqual(2)
      })
    })

    describe('when adding a non-existing node with dependencies, and some of the deps do not exist', () => {
      let s1: Set<NodeId>
      beforeEach(() => {
        s1 = new Set<NodeId>([1, 2, 14])
        subject.addNode(12, s1)
      })

      it('should add the node to the keys', () => {
        expect(subject.keys()).toContain(12)
      })

      it('should add the non-existing dependent node to the keys', () => {
        expect(subject.keys()).toContain(14)
      })

      it('should store the dependencies correctly', () => {
        expect([...subject.get(12)]).toEqual([1, 2, 14])
      })

      it('should copy the given set', () => {
        expect(subject.get(12)).not.toBe(s1)
      })
    })

    describe('when adding an existing node', () => {
      beforeEach(() => {
        subject.addNode(1, [12, 14])
      })

      it('should add the non-existing dependent node to the keys', () => {
        expect(subject.keys()).toContain(12)
        expect(subject.keys()).toContain(14)
      })

      it('should add the deps to the existing list', () => {
        expect(subject.get(1)).toEqual(new Set<NodeId>([2, 3, 12, 14]))
      })
    })
  })

  describe('hasCycle', () => {
    describe('given a NodeMap with a single node with no deps', () => {
      beforeEach(() => {
        subject = new NodeMap([[1, new Set<NodeId>()]])
      })

      it('should return false', () => {
        expect(subject.hasCycle(1)).toBe(false)
      })
    })

    describe('given a NodeMap with a single node the points to itself', () => {
      beforeEach(() => {
        subject = new NodeMap([[1, new Set<NodeId>([1])]])
      })

      it('should return true', () => {
        expect(subject.hasCycle(1)).toBe(true)
      })
    })

    describe('given a NodeMap with a few nodes and a cycle', () => {
      beforeEach(() => {
        subject = new NodeMap([
          [1, new Set<NodeId>([2])],
          [2, new Set<NodeId>([3, 4])],
          [3, new Set<NodeId>([1])],
          [4, new Set<NodeId>([5])],
        ])
      })

      describe('when starting from a node with no cycle', () => {
        it('should return false', () => {
          expect(subject.hasCycle(4)).toBe(false)
        })
      })

      describe('when starting from a node with a cycle', () => {
        it('should return true', () => {
          expect(subject.hasCycle(1)).toBe(true)
        })
      })
    })

    describe('given a NodeMap with a few nodes and no cycle', () => {
      beforeEach(() => {
        subject = new NodeMap([
          [1, new Set<NodeId>([2])],
          [2, new Set<NodeId>([3, 4])],
          [3, new Set<NodeId>([4])],
        ])
      })

      describe('when starting from a node that reaches the entire graph', () => {
        it('should return false', () => {
          expect(subject.hasCycle(1)).toBe(false)
        })
      })

      describe('when starting from a node that does not reach the entire graph', () => {
        it('should return false', () => {
          expect(subject.hasCycle(4)).toBe(false)
        })
      })
      it('should return false', () => {
        expect(subject.hasCycle(1)).toBe(false)
      })
    })
  })

  describe('deleteNode', () => {
    let result: NodeId[]
    beforeEach(() => {
      subject = new NodeMap([
        [1, new Set<NodeId>([2, 3])],
        [2, new Set<NodeId>([2, 3, 4])],
        [3, new Set<NodeId>([1])],
        [4, new Set<NodeId>([5, 2])],
      ])
      result = [...subject.deleteNode(3)]
    })

    it('should delete the node from the keys', () => {
      expect([...subject.keys()]).toEqual([1, 2, 4])
    })

    it('should delete the node from the deps', () => {
      expect([...subject.get(1)]).toEqual([2])
      expect([...subject.get(2)]).toEqual([2, 4])
    })

    describe('return value', () => {
      it('should be the list of affected nodes', () => {
        expect(result).toEqual([1, 2])
      })

      it('should be re-iteratable', () => {
        expect([...result]).toEqual([...result])
      })
    })
  })

  describe('evaluationOrderGroups', () => {
    let res: NodeId[][]
    const getResult = (): void => {
      res = [...wu(subject.evaluationOrderGroups()).map(g => [...g])]
    }

    describe('for a simple graph', () => {
      beforeEach(() => {
        subject.addNode(2, [1])
        subject.addNode(3, [2])
        subject.addNode(4, [2])
        getResult()
      })

      it('should return the nodes in the correct order', () => {
        expect(res).toEqual([[1], [2], [3, 4]])
      })
    })

    describe('for an empty graph', () => {
      beforeEach(getResult)

      it('should return an empty array', () => {
        expect(res).toEqual([])
      })
    })

    describe('for a graph with a circular dependency', () => {
      beforeEach(() => {
        subject.addNode(2, [1])
        subject.addNode(3, [2, 4])
        subject.addNode(4, [2, 3])
      })

      it('should throw an exception', () => {
        expect(getResult).toThrow(CircularDependencyError)
      })
    })
  })

  describe('evaluationOrder', () => {
    let res: NodeId[]
    const getResult = (): void => {
      res = [...wu(subject.evaluationOrder())]
    }

    describe('for a simple graph', () => {
      beforeEach(() => {
        subject.addNode(2, [1])
        subject.addNode(3, [2])
        subject.addNode(4, [2])
        getResult()
      })

      it('should return the nodes in the correct order', () => {
        expect(res).toEqual([1, 2, 3, 4])
      })
    })

    describe('for an empty graph', () => {
      beforeEach(getResult)

      it('should return an empty array', () => {
        expect(res).toEqual([])
      })
    })

    describe('for a graph with a circular dependency', () => {
      beforeEach(() => {
        subject.addNode(2, [1])
        subject.addNode(3, [2, 4])
        subject.addNode(4, [2, 3])
      })

      it('should throw an exception', () => {
        expect(getResult).toThrow(CircularDependencyError)
      })
    })
  })

  describe('walkSync', () => {
    let handler: jest.Mock<void>

    beforeEach(() => {
      const handled = new Set<NodeId>()
      handler = jest.fn((nodeId: string) => {
        handled.add(nodeId)
        expect(wu(subject.get(nodeId)).every(n => handled.has(n))).toBeTruthy()
      })

      subject.addNode(2, [1])
      subject.addNode(3, [2])
      subject.addNode(4, [2])
    })

    describe('for a simple graph', () => {
      beforeEach(() => subject.walkSync(handler))

      it('should call the handler in the correct order', () => {
        expect(_.flatten(handler.mock.calls)).toEqual([1, 2, 3, 4])
      })
    })

    describe('for a graph with a circular dependency', () => {
      beforeEach(() => {
        subject.addNode(1, [4])
      })

      it(
        'should throw CircularDependencyError',
        () => expect(() => subject.walkSync(handler)).toThrow(CircularDependencyError)
      )
    })
  })

  describe('walk', () => {
    let handler: jest.Mock<Promise<void>>
    let result: Promise<void>
    let concurrencyCounter: MaxCounter

    // simulates an async operation in zero time
    const dummyAsyncOperation = (): Promise<void> =>
      new Promise(resolve => setTimeout(resolve, 0))

    beforeEach(() => {
      concurrencyCounter = new MaxCounter()
      const handled = new Set<NodeId>()

      handler = jest.fn(async node => {
        concurrencyCounter.increment()
        expect(handled).not.toContain(node)
        expect(wu(subject.get(node)).every(n => handled.has(n))).toBeTruthy()
        await dummyAsyncOperation()
        handled.add(node)
        concurrencyCounter.decrement()
      })

      subject.addNode(2, [1])
      subject.addNode(3, [2])
      subject.addNode(4, [2])
      subject.addNode(5, [1])
    })

    describe('for a simple graph', () => {
      beforeEach(() => {
        result = subject.walk(handler)
        return result
      }, 0)

      it('should resolve the promise', () => {
        expect(result).resolves.toBeUndefined()
      })

      it('should call the handler in the correct order', () => {
        expect(_.flatten(handler.mock.calls)).toEqual([1, 2, 5, 3, 4])
      })

      it('should call the handler as concurrently as possible', () => {
        expect(concurrencyCounter.maximum).toBe(3)
      })
    })

    describe('for a graph with a circular dependency', () => {
      beforeEach(() => {
        subject.addNode(1, [4])
        result = subject.walk(handler)
      })

      it(
        'should reject with CircularDependencyError',
        () => expect(result).rejects.toBeInstanceOf(CircularDependencyError)
      )
    })
  })

  describe('reverse', () => {
    describe('for an empty graph', () => {
      it('should return an empty graph', () => {
        expect([...subject.reverse().entries()]).toEqual([])
      })
    })

    describe('for a simple graph', () => {
      beforeEach(() => {
        subject.addNode(2, [1, 3])
        subject.addNode(3)
        subject.addNode(4, [2])
        subject.addNode(5, [1])
      })

      it('should return the correct result', () => {
        expect([...subject.reverse().entries()]).toEqual([
          [1, new Set<NodeId>([2, 5])],
          [2, new Set<NodeId>([4])],
          [3, new Set<NodeId>([2])],
          [4, new Set<NodeId>([])],
          [5, new Set<NodeId>([])],
        ])
      })
    })
  })

  describe('removeRedundantEdges', () => {
    beforeEach(() => {
      subject.addNode(2, [1])
      subject.addNode(3, [2])
      subject.addNode(4, [2])
      subject.addNode(3, [1])
      expect(subject.edges().length).toEqual(4)
      subject.removeRedundantEdges()
    })

    it('should remove the redundant edge', () => {
      expect(subject.edges().length).toBe(3)
      expect(subject.edges()).toEqual([[2, 1], [3, 2], [4, 2]])
    })

    describe('when there is a circular dependency', () => {
      beforeEach(() => {
        subject.addNode(1, [4])
      })

      it('throws an exception', () => {
        expect(() => subject.removeRedundantEdges()).toThrow(
          CircularDependencyError
        )
      })
    })
  })

  describe('tryTransform', () => {
    let transformResult: NodeMap

    describe('when the transformation does not create a cycle', () => {
      beforeEach(() => {
        subject.addNode(1, [2])
        subject.addNode(2, [3, 4])
        transformResult = subject.tryTransform(nm => [...nm.deleteNode(1)][0])
      })

      it('should return a new NodeMap', () => {
        expect(transformResult).not.toBe(subject)
      })

      it('should return the transformed NodeMap', () => {
        expect(transformResult.nodes()).not.toContain(1)
      })
    })

    describe('when the transformation creates a cycle', () => {
      beforeEach(() => {
        subject.addNode(1, [2])
        transformResult = subject.tryTransform(nm => {
          nm.addNode(2, [3])
          nm.addNode(3, [1, 2])
          return 2
        })
      })

      it('should return the original NodeMap', () => {
        expect(transformResult).toBe(subject)
      })

      it('should return the untransformed NodeMap', () => {
        expect(transformResult.nodes()).not.toContain(3)
      })
    })
  })
})

describe('DataNodeMap', () => {
  let subject: DataNodeMap<object>
  beforeEach(() => {
    subject = new DataNodeMap<object>()
  })

  describe('addNode', () => {
    describe('when adding new nodes with data', () => {
      let n1d: object
      let n4d: object

      beforeEach(() => {
        n1d = {}
        subject.addNode(1, [2, 3], n1d)

        n4d = {}
        subject.addNode(4, [], n4d)
      })

      it('should add the data', () => {
        expect(subject.getData(1)).toBe(n1d)
        expect(subject.getData(4)).toBe(n4d)
      })

      it('should return undefined for nodes only specified in the deps', () => {
        expect(subject.getData(2)).toBeUndefined()
      })
    })
  })
})
