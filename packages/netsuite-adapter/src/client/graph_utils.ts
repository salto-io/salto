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
import { CustomizationInfo } from './types'


export type SDFObjectNode = {
  elemIdFullName: string
  serviceid: string
  changeType: 'addition' | 'modification'
  customizationInfo: CustomizationInfo
}

export class GraphNode<T> {
  edges: Map<T[keyof T], GraphNode<T>>
  value: T
  id: string

  constructor(value: T, id: string) {
    this.value = value
    this.edges = new Map<T[keyof T], GraphNode<T>>()
    this.id = id
  }

  addEdge(key: keyof T, node: GraphNode<T>): void {
    this.edges.set(node.value[key], node)
  }
}

type DFSParameters<T>= {
  node: GraphNode<T>
  visited: Set<T[keyof T]>
  resultArray?: GraphNode<T>[]
  // optional parameters for cycle detection
  path?: T[keyof T][]
  cycle?: T[keyof T][]
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
      if (!this.nodes.has(node.value[this.key])) {
        this.nodes.set(node.value[this.key], node)
      }
    })
  }

  private dfs(dfsParams: DFSParameters<T>): void {
    const { node, visited, resultArray = [], path = [], cycle = [] } = dfsParams
    if (visited.has(node.value[this.key])) {
      const cycleStartIndex = path.indexOf(node.value[this.key])
      if (cycleStartIndex !== -1) {
        // node is visited & in path mean its a cycle
        cycle.push(...(path.slice(cycleStartIndex)))
      }
      return
    }
    visited.add(node.value[this.key])
    node.edges.forEach(dependency => {
      this.dfs({ node: dependency, visited, resultArray, path: path.concat(node.value[this.key]), cycle })
    })
    resultArray.push(node)
  }

  getTopologicalOrder(): GraphNode<T>[] {
    const visited = new Set<T[keyof T]>()
    const sortedNodes: GraphNode<T>[] = []
    Array.from(this.nodes.values()).forEach(node => {
      this.dfs({ node, visited, resultArray: sortedNodes })
    })
    return sortedNodes.reverse()
  }

  getNodeDependencies(startNode: GraphNode<T>): GraphNode<T>[] {
    if (_.isEmpty(startNode.edges)) {
      return [startNode]
    }
    const visited = new Set<T[keyof T]>()
    const dependencies: GraphNode<T>[] = []
    this.dfs({ node: startNode, visited, resultArray: dependencies })
    return dependencies
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

  removeNode(key: T[keyof T]): void {
    const node = this.nodes.get(key)
    if (node) {
      Array.from(this.nodes.values()).forEach(otherNode => {
        otherNode.edges.delete(key)
      })
      this.nodes.delete(key)
    }
  }

  findCycle(): T[keyof T][] {
    const visited = new Set<T[keyof T]>()
    const nodesInCycle: T[keyof T][] = []

    Array.from(this.nodes.values()).forEach(node => {
      if (!visited.has(node.value[this.key])) {
        this.dfs({ node, visited, cycle: nodesInCycle })
      }
    })
    return nodesInCycle
  }
}
