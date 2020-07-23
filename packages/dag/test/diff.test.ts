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
import { DataNodeMap } from '../src/nodemap'
import { removeEqualNodes, DiffNode, DiffGraph, mergeNodesToModify, ModificationDiff } from '../src/diff'

describe('DiffGraph functions', () => {
  const diffNode = <T>(
    originalId: DiffNode<T>['originalId'],
    action: 'add' | 'remove',
    data: T
  ): DiffNode<T> => (
      action === 'add'
        ? { action, originalId, data: { after: data } }
        : { action, originalId, data: { before: data } }
    )

  let subject: DiffGraph<string>
  const graph = new DataNodeMap<DiffNode<string>>()

  beforeEach(() => {
    graph.clear()
  })

  describe('removeEqualNodes', () => {
    let equalNodes: jest.Mock
    beforeEach(() => {
      equalNodes = jest.fn().mockReturnValue(true)
    })

    describe('with two nodes for the same id', () => {
      beforeEach(() => {
        graph.addNode('remove', [], diffNode(1, 'remove', 'data'))
        graph.addNode('add', [], diffNode(1, 'add', 'data'))
      })

      describe('when nodes are equal', () => {
        beforeEach(async () => {
          equalNodes.mockReturnValueOnce(true)
          subject = await removeEqualNodes(equalNodes)(graph)
        })
        it('should call equals func', () => {
          expect(equalNodes).toHaveBeenCalled()
        })
        it('should remove the nodes', () => {
          expect(subject.size).toBe(0)
        })
      })

      describe('when nodes are not equal', () => {
        beforeEach(async () => {
          equalNodes.mockReturnValueOnce(false)
          subject = await removeEqualNodes(equalNodes)(graph)
        })
        it('should call equals func', () => {
          expect(equalNodes).toHaveBeenCalled()
        })
        it('should not remove the nodes', () => {
          expect(subject.size).toBe(2)
        })
      })
    })

    describe('with nodes of different ids', () => {
      beforeEach(async () => {
        graph.addNode('remove', [], diffNode(1, 'remove', 'data'))
        graph.addNode('add', [], diffNode(2, 'add', 'data'))

        subject = await removeEqualNodes(equalNodes)(graph)
      })
      it('should not call equals func', () => {
        expect(equalNodes).not.toHaveBeenCalled()
      })
      it('should not remove the nodes', () => {
        expect(subject.size).toBe(2)
      })
    })
  })

  describe('mergeNodesToModify', () => {
    describe('when add and remove are not of the same id', () => {
      beforeEach(async () => {
        graph.addNode('remove', [], diffNode(1, 'remove', 'data'))
        graph.addNode('add', [], diffNode(2, 'add', 'data'))

        subject = graph.clone()
        mergeNodesToModify(subject)
      })
      it('should not merge nodes', () => {
        expect(subject.size).toBe(2)
      })
    })
    describe('when add and remove are of the same id', () => {
      describe('when add and remove can be merged with no cycle', () => {
        beforeEach(async () => {
          graph.addNode(1, [3], diffNode(1, 'remove', 'before'))
          graph.addNode(2, [1, 4], diffNode(1, 'add', 'after'))
          graph.addNode(3, [], diffNode(2, 'add', ''))
          graph.addNode(4, [], diffNode(3, 'add', ''))
          graph.addNode(5, [1], diffNode(4, 'add', ''))
          graph.addNode(6, [2], diffNode(5, 'add', ''))

          subject = graph.clone()
          mergeNodesToModify(subject)
        })
        it('should merge the nodes', () => {
          expect(subject.size).toBe(graph.size - 1)
        })
        describe('merged node', () => {
          let mergedId: collections.set.SetId
          let mergedNode: DiffNode<string>
          let deps: Set<collections.set.SetId>
          beforeEach(() => {
            [mergedId] = wu(subject.keys()).filter(key => subject.getData(key).originalId === 1)
            mergedNode = subject.getData(mergedId)
            deps = subject.get(mergedId)
          })
          it('should have modification action', () => {
            expect(mergedNode.action).toEqual('modify')
          })
          it('should have before and after data', () => {
            expect((mergedNode as ModificationDiff<string>).data.before).toEqual('before')
            expect((mergedNode as ModificationDiff<string>).data.after).toEqual('after')
          })
          it('should have the same original id', () => {
            expect(mergedNode.originalId).toEqual(1)
          })
          it('should have the dependencies of both original nodes', () => {
            expect(deps).toEqual(new Set([3, 4]))
          })
          it('should have the reverse dependencies of original nodes', () => {
            expect(subject.get(5)).toContain(mergedId)
            expect(subject.get(6)).toContain(mergedId)
          })
        })
      })
      describe('when merging add and remove would cause a cycle', () => {
        beforeEach(async () => {
          graph.addNode(1, [], diffNode(1, 'add', 'after'))
          graph.addNode(2, [1, 3], diffNode(1, 'remove', 'before'))
          graph.addNode(3, [1], diffNode(2, 'add', 'data'))

          subject = graph.clone()
          mergeNodesToModify(subject)
        })
        it('should not merge the nodes', () => {
          expect(subject).toEqual(graph)
        })
      })
    })
  })
})
