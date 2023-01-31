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

import _ from 'lodash'

export class GraphNode<T> {
  edges: GraphNode<T>[]
  value: T

  constructor(value: T) {
    this.value = value
    this.edges = []
  }

  addEdge(node: GraphNode<T>): void {
    this.edges.push(node)
  }
}

export class Graph<T> {
  nodes: GraphNode<T>[]

  constructor() {
    this.nodes = []
  }

  addNodes(...node: GraphNode<T>[]): void {
    this.nodes.push(...node)
  }

  dfs(node: GraphNode<T>, visited: Set<GraphNode<T>>): void {
    visited.add(node)
    node.edges.forEach(dependency => {
      if (!visited.has(dependency)) {
        this.dfs(dependency, visited)
      }
    })
  }

  getNodeDependencies(nodeToRemove: GraphNode<T>): GraphNode<T>[] {
    const visited = new Set<GraphNode<T>>()
    this.dfs(nodeToRemove, visited)
    return this.nodes.filter(node => visited.has(node))
  }

  findNode(value: T): GraphNode<T> | undefined {
    return this.nodes.find(node => _.isEqual(node.value, value))
  }

  findNodeByField(field: keyof T, value: T[keyof T]): GraphNode<T> | undefined {
    return this.nodes.find(node => _.isEqual(node.value[field], value))
  }
}
