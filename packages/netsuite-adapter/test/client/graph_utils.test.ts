/*
*                      Copyright 2023 Salto Labs Ltd.
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
  const testGraph = new Graph<testNode>()
  const testNode1 = new GraphNode({ name: 'node1', num: 1 })
  const testNode2 = new GraphNode({ name: 'node2', num: 2 })
  const testNode3 = new GraphNode({ name: 'node3', num: 3 })
  testNode2.addEdge(testNode1)
  testNode1.addEdge(testNode3)
  testNode1.addEdge(testNode2)
  testGraph.addNodes(testNode1, testNode2, testNode3)


  it('should find the nodes dependencies', async () => {
    expect(testGraph.getNodeDependencies(testNode1)).toEqual([testNode1, testNode2, testNode3])
  })

  it('should find the node through its value', async () => {
    const someNodeValue = { name: 'node2', num: 2 }
    expect(testGraph.findNode(someNodeValue)).toEqual(testNode2)
  })

  it('should fail to find un-existing node', async () => {
    expect(testGraph.findNode({ name: 'unexistingNode', num: 4 })).toBeUndefined()
  })

  it('should find node by field', async () => {
    expect(testGraph.findNodeByField('name', 'node3')).toEqual(testNode3)
  })
})
