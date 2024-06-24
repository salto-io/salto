/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import { Graph, GraphNode } from '../../src/client/graph_utils'

type testNode = {
  name: string
  num: number
}

describe('graph utils tests', () => {
  let testGraph: Graph<testNode>
  let testNode1: GraphNode<testNode>
  let testNode2: GraphNode<testNode>
  let testNode3: GraphNode<testNode>
  beforeEach(() => {
    testNode1 = new GraphNode('node1', { name: 'node1', num: 1 })
    testNode2 = new GraphNode('node2', { name: 'node2', num: 2 })
    testNode3 = new GraphNode('node3', { name: 'node3', num: 3 })
    testGraph = new Graph<testNode>([testNode1, testNode2, testNode3])
    testNode1.addEdge(testNode2)
    testNode1.addEdge(testNode3)
    testNode2.addEdge(testNode1)
  })

  it('should find the nodes dependencies', async () => {
    const result = testGraph.getNodeDependencies(testNode1)
    expect(result).toHaveLength(3)
    expect(result).toEqual(expect.arrayContaining([testNode2, testNode3, testNode1]))
  })

  it('should find node by key', async () => {
    expect(testGraph.getNode('node1')).toEqual(testNode1)
  })

  it('should find node by field', async () => {
    expect(testGraph.findNodeByField('name', 'node3')).toEqual(testNode3)
  })

  it('should return nodes in topological sort', async () => {
    expect(testGraph.getTopologicalOrder()).toEqual([testNode1, testNode3, testNode2])
  })
  it('should find the cycle in the graph and return its nodes', async () => {
    const cycleNodes = testGraph.findCycle()
    expect(cycleNodes).toHaveLength(2)
    expect(cycleNodes).toEqual([testNode1.value.name, testNode2.value.name])
  })

  it('should remove node from graph and edges from nodes', async () => {
    testGraph.removeNode('node1')
    expect(testGraph.nodes.get('node1')).toBeUndefined()
    expect(testNode2.edges).not.toContain(testNode1)
  })
  it('should return an empty array if there is no cycle', async () => {
    const testNode4 = new GraphNode('node4', { name: 'node4', num: 1 })
    const testNode5 = new GraphNode('node5', { name: 'node5', num: 2 })
    const testNode6 = new GraphNode('node6', { name: 'node6', num: 3 })
    testNode4.addEdge(testNode5)
    testNode4.addEdge(testNode6)
    testGraph = new Graph<testNode>([testNode4, testNode5, testNode6])
    const cycleNodes = testGraph.findCycle()
    expect(cycleNodes).toHaveLength(0)
  })
})
