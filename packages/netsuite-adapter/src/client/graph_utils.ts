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
import wu from 'wu'

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
  nodes: Map<T[keyof T], GraphNode<T>>
  key: keyof T

  constructor(key: keyof T, nodes: GraphNode<T>[] = []) {
    this.nodes = new Map()
    this.key = key
    nodes.forEach(node => this.nodes.set(node.value[key], node))
  }

  addNodes(nodes: GraphNode<T>[]): void {
    nodes.forEach(node => {
      if (!this.nodes.get(node.value[this.key])) {
        this.nodes.set(node.value[this.key], node)
      }
    })
  }

  private dfs(node: GraphNode<T>, visited: Map<T[keyof T], GraphNode<T>>): void {
    visited.set(node.value[this.key], node)
    node.edges.forEach(dependency => {
      if (!visited.get(dependency.value[this.key])) {
        this.dfs(dependency, visited)
      }
    })
  }

  getNodeDependencies(startNode: GraphNode<T>): GraphNode<T>[] {
    if (_.isEmpty(startNode.edges)) {
      return [startNode]
    }
    const visited = new Map<T[keyof T], GraphNode<T>>()
    this.dfs(startNode, visited)
    return Array.from(visited.values())
  }

  findNode(value: T): GraphNode<T> | undefined {
    return this.nodes.get(value[this.key])
  }

  findNodeByKey(key: T[keyof T]): GraphNode<T> | undefined {
    return this.nodes.get(key)
  }

  findNodeByField(key: keyof T, value: T[keyof T]): GraphNode<T> | undefined {
    return wu(this.nodes.values()).find(node => _.isEqual(node.value[key], value))
  }
}
