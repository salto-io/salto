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
import _ from 'lodash'
import {
  NodeMap, NodeId, CircularDependencyError, DataNodeMap, WalkError, NodeSkippedError,
} from '../src/nodemap'

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

    it('should delete the node from reverse deps', () => {
      expect(subject.getReverse(1)).not.toContain(3)
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

  describe('cloneWithout', () => {
    let result: NodeMap

    beforeEach(() => {
      subject = new NodeMap([
        [1, new Set<NodeId>([2, 3])],
        [2, new Set<NodeId>([2, 3, 4])],
        [3, new Set<NodeId>([1])],
        [4, new Set<NodeId>([5, 2])],
        [6, new Set<NodeId>([7])],
      ])
      result = subject.cloneWithout(new Set([3, 2]))
    })

    it('does not modify the original', () => {
      expect(result).not.toBe(subject)
      expect([...subject.get(3)]).toEqual([1])
      expect([...subject.get(2)]).toEqual([2, 3, 4])
      expect([...subject.get(4)]).toEqual([5, 2])
    })

    describe('the result', () => {
      it('should not contain the specified no IDs in the keys', () => {
        expect(result.has(3)).toBeFalsy()
        expect([...result.get(3)]).toEqual([])

        expect(result.has(2)).toBeFalsy()
        expect([...result.get(2)]).toEqual([])
      })

      it('should not contain the specified node IDs in the deps', () => {
        expect([...result.get(1)]).toEqual([])
        expect([...result.get(4)]).toEqual([5])
      })

      it('should contain all the other IDs', () => {
        expect([...result.get(6)]).toEqual([7])
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

  describe('walk', () => {
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
        let error: WalkError
        beforeEach(() => {
          subject.addNode(1, [4])
          try {
            subject.walkSync(handler)
          } catch (e) {
            error = e
          }
        })

        it('should reject with WalkError', () => {
          expect(error).toBeInstanceOf(WalkError)
        })

        describe('the error\'s "circularDependencyError" property', () => {
          let depError: CircularDependencyError
          beforeEach(() => {
            depError = error.circularDependencyError as CircularDependencyError
          })

          it('should be an instance of CircularDependencyError', () => {
            expect(depError).toBeInstanceOf(CircularDependencyError)
          })

          it('should have a proper message', () => {
            expect(String(depError)).toContain(
              'Circular dependencies exist among these items: 2->[1], 1->[4], 3->[2], 4->[2]'
            )
          })
        })
      })

      describe('when the handler throws an error', () => {
        class MyError extends Error {
        }

        let handlerError: MyError
        let error: Error

        beforeEach(() => {
          try {
            subject.walkSync((id: NodeId) => {
              if (id === 2) {
                handlerError = new MyError('My error message')
                throw handlerError
              }
            })
          } catch (e) {
            error = e
          }
          expect(error).toBeDefined()
        })

        it('should throw a WalkError', () => {
          expect(error).toBeInstanceOf(WalkError)
        })

        describe('the error message', () => {
          let message: string
          beforeEach(() => {
            message = error.message
          })

          it('should contain the id of the errored node with the error\'s message', () => {
            expect(message).toContain('2: Error: My error message')
          })

          it('should contain the ids of the skipped nodes with a "skipped" message', () => {
            expect(message).toContain('3: Error: Skipped due to an error in parent node 2')
            expect(message).toContain('4: Error: Skipped due to an error in parent node 2')
          })
        })

        describe('the error\'s "errors" property', () => {
          let errors: ReadonlyMap<NodeId, Error>
          beforeEach(() => {
            errors = (error as WalkError).handlerErrors
          })

          it('should contain the id of the errored node with the error', () => {
            expect(errors.get(2)).toBe(handlerError)
          })

          it('should contain the ids of the skipped nodes with a "skipped" Error', () => {
            expect(errors.get(3)).toBeInstanceOf(NodeSkippedError)
            expect(errors.get(4)).toBeInstanceOf(NodeSkippedError)
          })
        })
      })

      describe('when there is a circular dependency AND the handler throws an error', () => {
        class MyError extends Error {
        }

        let handlerError: MyError
        let error: WalkError

        beforeEach(() => {
          subject.addNode(2, [3])
          subject.addNode(6, [5])
          try {
            subject.walkSync((id: NodeId) => {
              if (id === 5) {
                handlerError = new MyError('My error message')
                throw handlerError
              }
            })
          } catch (e) {
            error = e
          }
          expect(error).toBeDefined()
        })

        it('should throw a WalkError', () => {
          expect(error).toBeInstanceOf(WalkError)
        })

        describe('the error message', () => {
          let message: string
          beforeEach(() => {
            message = error.message
          })

          it('should contain the id of the errored node with the error\'s message', () => {
            expect(message).toContain('5: Error: My error message')
          })

          it('should contain the ids of the skipped nodes with a "skipped" message', () => {
            expect(message).toContain('6: Error: Skipped due to an error in parent node 5')
          })
        })

        describe('the error\'s "errors" property', () => {
          let errors: ReadonlyMap<NodeId, Error>
          beforeEach(() => {
            errors = (error as WalkError).handlerErrors
          })

          it('should contain the id of the errored node with the error', () => {
            expect(errors.get(5)).toBe(handlerError)
          })

          it('should contain the ids of the skipped nodes with a "skipped" Error', () => {
            expect(errors.get(6)).toBeInstanceOf(NodeSkippedError)
          })
        })

        describe('the error\'s "circularDependencyError" property', () => {
          let depError: CircularDependencyError
          beforeEach(() => {
            depError = error.circularDependencyError as CircularDependencyError
          })

          it('should be an instance of CircularDependencyError', () => {
            expect(depError).toBeInstanceOf(CircularDependencyError)
          })

          it('should have a proper message', () => {
            expect(String(depError)).toContain(
              'Circular dependencies exist among these items: 2->[3], 3->[2], 4->[2]'
            )
          })
        })
      })
    })

    describe('walkAsync', () => {
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
        beforeEach(async () => {
          result = subject.walkAsync(handler)
          await result
        }, 0)

        it('should resolve the promise', () => expect(result).resolves.toBeUndefined())

        it('should call the handler in the correct order', () => {
          expect(_.flatten(handler.mock.calls)).toEqual([1, 2, 5, 3, 4])
        })

        it('should call the handler as concurrently as possible', async () => {
          expect(concurrencyCounter.maximum).toBeGreaterThanOrEqual(2)
        })
      })

      describe('for a graph with a circular dependency', () => {
        let error: WalkError
        beforeEach(async () => {
          subject.get(2).add(3)
          await subject.walkAsync(handler).catch(e => {
            error = e
          })
        })

        it('should reject with WalkError', () => {
          expect(error).toBeInstanceOf(WalkError)
        })

        describe('the error\'s "circularDependencyError" property', () => {
          let depError: CircularDependencyError
          beforeEach(() => {
            depError = error.circularDependencyError as CircularDependencyError
          })

          it('should be an instance of CircularDependencyError', () => {
            expect(depError).toBeInstanceOf(CircularDependencyError)
          })

          it('should have a proper message', () => {
            expect(String(depError)).toContain(
              'Circular dependencies exist among these items: 2->[3], 3->[2], 4->[2]'
            )
          })
        })
      })

      describe('when the handler throws an error', () => {
        class MyError extends Error {
        }

        let handlerError: MyError
        let error: Error

        beforeEach(async () => {
          await subject.walkAsync(async (id: NodeId) => {
            if (id === 2) {
              handlerError = new MyError('My error message')
              throw handlerError
            }
          }).catch(e => {
            error = e
          })
          expect(error).toBeDefined()
        })

        it('should throw a WalkError', () => {
          expect(error).toBeInstanceOf(WalkError)
        })

        describe('the error message', () => {
          let message: string
          beforeEach(() => {
            message = error.message
          })

          it('should contain the id of the errored node with the error\'s message', () => {
            expect(message).toContain('2: Error: My error message')
          })

          it('should contain the ids of the skipped nodes with a "skipped" message', () => {
            expect(message).toContain('3: Error: Skipped due to an error in parent node 2')
            expect(message).toContain('4: Error: Skipped due to an error in parent node 2')
          })
        })

        describe('the error\'s "errors" property', () => {
          let errors: ReadonlyMap<NodeId, Error>
          beforeEach(() => {
            errors = (error as WalkError).handlerErrors
          })

          it('should contain the id of the errored node with the error', () => {
            expect(errors.get(2)).toBe(handlerError)
          })

          it('should contain the ids of the skipped nodes with a "skipped" Error', () => {
            expect(errors.get(3)).toBeInstanceOf(NodeSkippedError)
            expect(errors.get(4)).toBeInstanceOf(NodeSkippedError)
          })
        })
      })

      describe('when there is a circular dependency AND the handler throws an error', () => {
        class MyError extends Error {
        }

        let handlerError: MyError
        let error: WalkError

        beforeEach(async () => {
          subject.addNode(2, [3])
          subject.addNode(6, [5])
          await subject.walkAsync(async (id: NodeId) => {
            if (id === 5) {
              handlerError = new MyError('My error message')
              throw handlerError
            }
          }).catch(e => {
            error = e
          })
          expect(error).toBeDefined()
        })

        it('should throw a WalkError', () => {
          expect(error).toBeInstanceOf(WalkError)
        })

        describe('the error message', () => {
          let message: string
          beforeEach(() => {
            message = error.message
          })

          it('should contain the id of the errored node with the error\'s message', () => {
            expect(message).toContain('5: Error: My error message')
          })

          it('should contain the ids of the skipped nodes with a "skipped" message', () => {
            expect(message).toContain('6: Error: Skipped due to an error in parent node 5')
          })
        })

        describe('the error\'s "errors" property', () => {
          let errors: ReadonlyMap<NodeId, Error>
          beforeEach(() => {
            errors = (error as WalkError).handlerErrors
          })

          it('should contain the id of the errored node with the error', () => {
            expect(errors.get(5)).toBe(handlerError)
          })

          it('should contain the ids of the skipped nodes with a "skipped" Error', () => {
            expect(errors.get(6)).toBeInstanceOf(NodeSkippedError)
          })
        })

        describe('the error\'s "circularDependencyError" property', () => {
          let depError: CircularDependencyError
          beforeEach(() => {
            depError = error.circularDependencyError as CircularDependencyError
          })

          it('should be an instance of CircularDependencyError', () => {
            expect(depError).toBeInstanceOf(CircularDependencyError)
          })

          it('should have a proper message', () => {
            expect(String(depError)).toContain(
              'Circular dependencies exist among these items: 2->[3], 3->[2], 4->[2]'
            )
          })
        })
      })
    })
  })

  describe('getReverse', () => {
    describe('for a simple graph', () => {
      beforeEach(() => {
        subject.addNode(2, [1, 3])
        subject.addNode(3)
        subject.addNode(4, [2])
        subject.addNode(5, [1])
      })

      it('should return the nodes that depend on the node in question', () => {
        expect(subject.getReverse(1)).toEqual(new Set([2, 5]))
        expect(subject.getReverse(2)).toEqual(new Set([4]))
        expect(subject.getReverse(3)).toEqual(new Set([2]))
        expect(subject.getReverse(4)).toEqual(new Set())
        expect(subject.getReverse(5)).toEqual(new Set())
      })
    })
  })

  describe('addEdge', () => {
    describe('when nodes do not exist', () => {
      beforeEach(() => {
        subject.addEdge(10, 11)
      })
      it('should add both nodes', () => {
        expect(subject.keys()).toContain(10)
        expect(subject.keys()).toContain(11)
      })
      it('should add edge', () => {
        expect(subject.get(10)).toContain(11)
      })
      it('should add reverse edge', () => {
        expect(subject.getReverse(11)).toContain(10)
      })
    })
    describe('when nodes exist prior to edge', () => {
      beforeEach(() => {
        subject.addNode(1, [2, 3])
        subject.addNode(2, [4])
        subject.addEdge(2, 3)
      })
      it('should add new edge', () => {
        expect(subject.get(2)).toContain(3)
      })
      it('should add reverse edge', () => {
        expect(subject.getReverse(3)).toContain(2)
      })
      it('should maintain existing edges', () => {
        expect(subject.get(2)).toContain(4)
      })
    })
  })

  describe('removeEdge', () => {
    beforeEach(() => {
      subject.addEdge(1, 2)
    })
    describe('when edge exists', () => {
      beforeEach(() => {
        subject.removeEdge(1, 2)
      })
      it('should remove the edge', () => {
        expect(subject.get(1)).not.toContain(2)
      })
      it('should remove reverse edge', () => {
        expect(subject.getReverse(2)).not.toContain(1)
      })
    })
    describe('when edge does not exist', () => {
      beforeEach(() => {
        subject.removeEdge(4, 5)
      })
      it('should not create nodes', () => {
        expect(subject.keys()).not.toContain(4)
        expect(subject.keys()).not.toContain(5)
      })
    })
  })

  describe('clearEdges', () => {
    beforeEach(() => {
      subject.addNode(1, [2, 3])
      subject.addNode(2, [3, 4])
      subject.clearEdges()
    })
    it('should remove all edges', () => {
      expect(subject.edges()).toHaveLength(0)
    })
    it('should keep nodes', () => {
      expect([...subject.keys()].sort()).toEqual([1, 2, 3, 4])
    })
  })

  describe('doesCreateCycle', () => {
    let modificationResult: boolean
    let origGraph: NodeMap

    beforeEach(() => {
      subject.addNode(1, [2])
      subject.addNode(2, [3, 4])
      origGraph = subject.clone()
    })

    describe('when the modification does not create a cycle', () => {
      beforeEach(() => {
        modificationResult = subject.doesCreateCycle(new Map([[1, new Set([3, 4])]]), 1)
      })

      it('should return true', () => {
        expect(modificationResult).toBeFalsy()
      })

      it('should not modify the graph', () => {
        expect(subject).toEqual(origGraph)
      })
    })

    describe('when the modification creates a cycle', () => {
      beforeEach(() => {
        modificationResult = subject.doesCreateCycle(new Map([[3, new Set([1])]]), 3)
      })

      it('should return false', () => {
        expect(modificationResult).toBeTruthy()
      })

      it('should not modify the graph', () => {
        expect(subject).toEqual(origGraph)
      })
    })
  })
})

describe('DataNodeMap', () => {
  let subject: DataNodeMap<object>
  let n1d: object
  let n2d: object
  let n3d: object
  let n4d: object

  beforeEach(() => {
    subject = new DataNodeMap<object>()
    n1d = {}
    n2d = {}
    n3d = {}
    n4d = {}
  })

  describe('addNode', () => {
    describe('when adding new nodes with data', () => {
      beforeEach(() => {
        subject.addNode(1, [2, 3], n1d)
        subject.addNode(4, [], n4d)
      })

      it('should add the data', () => {
        expect(subject.getData(1)).toBe(n1d)
        expect(subject.getData(4)).toBe(n4d)
      })

      it('should throw for nodes only specified in the deps', () => {
        expect(() => subject.getData(2)).toThrow(/\b2\b.*\bNode has no data/)
      })

      it('should throw for nonexistent nodes', () => {
        expect(() => subject.getData(14)).toThrow(/\b14\b.*\bNode does not exist/)
      })
    })
  })

  describe('cloneWithout', () => {
    let result: DataNodeMap<object>

    beforeEach(() => {
      subject.addNode(1, [2, 3], n1d)
      subject.addNode(2, [2, 3, 4], n2d)
      subject.addNode(3, [1], n3d)
      subject.addNode(4, [5, 2], n4d)
      result = subject.cloneWithout(new Set([3, 2]))
    })

    it('does not modify the original', () => {
      expect(result).not.toBe(subject)
      expect([...subject.get(3)]).toEqual([1])
      expect(subject.getData(3)).toBe(n3d)
    })

    describe('the result', () => {
      it('should not contain the specified no IDs in the keys', () => {
        expect(result.has(3)).toBeFalsy()
        expect(() => result.getData(3)).toThrow(/Node does not exist/)
        expect(result.has(2)).toBeFalsy()
        expect(() => result.getData(2)).toThrow(/Node does not exist/)
      })

      it('should not contain the specified node IDs in the deps', () => {
        expect([...result.get(1)]).toEqual([])
        expect([...result.get(4)]).toEqual([5])
      })
    })
  })
})
