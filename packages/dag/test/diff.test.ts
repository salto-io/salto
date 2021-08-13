/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { DataNodeMap } from '../src/nodemap'
import { removeEqualNodes, DiffNode, DiffGraph } from '../src/diff'

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
})
