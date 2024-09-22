/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isString } from 'util'
import { collections } from '@salto-io/lowerdash'
import wu from 'wu'
import { buildAcyclicGroupedGraph, Group, GroupKeyFunc, GroupDAG } from '../src/group'
import { DataNodeMap, Edge, NodeId } from '../src/nodemap'

describe('buildGroupGraph', () => {
  let subject: GroupDAG<string>
  const origin = new DataNodeMap<string>()
  const groupKey = (name: collections.set.SetId): string => (isString(name) ? name.split('_')[0] : '')

  beforeEach(() => {
    origin.clear()
  })

  const getGroupNodes = (): Group<string>[] =>
    [...subject.evaluationOrder()].map(groupId => subject.getData(groupId) as Group<string>)

  const compareGroup = (group: Group<string>, key: string, items: { key: string; data: string }[]): void => {
    expect(group.groupKey).toBe(key)
    expect(group.items.size).toBe(items.length)
    items.forEach(item => expect(group.items.get(item.key)).toBe(item.data))
  }

  it('should return empty group graph for empty origin', () => {
    subject = buildAcyclicGroupedGraph({ source: origin, groupKey, shouldFailOnCircularDependency: true }).graph
    expect(getGroupNodes()).toEqual([])
  })

  it('should create group for each element in origin', () => {
    origin.addNode('n1', ['n2', 'n3'], 'n1_data')
    origin.addNode('n2', ['n3'], 'n2_data')
    origin.addNode('n3', [], 'n3_data')
    subject = buildAcyclicGroupedGraph({ source: origin, groupKey, shouldFailOnCircularDependency: true }).graph

    const groupGraph = getGroupNodes()
    expect(groupGraph).toHaveLength(3)
    compareGroup(groupGraph[0], 'n3', [{ key: 'n3', data: 'n3_data' }])
    compareGroup(groupGraph[1], 'n2', [{ key: 'n2', data: 'n2_data' }])
    compareGroup(groupGraph[2], 'n1', [{ key: 'n1', data: 'n1_data' }])
  })

  it('should group multiple nodes to single group', () => {
    origin.addNode('group1_n1', [], 'n1_data')
    origin.addNode('group1_n2', [], 'n2_data')
    origin.addNode('group1_n3', [], 'n3_data')
    subject = buildAcyclicGroupedGraph({ source: origin, groupKey, shouldFailOnCircularDependency: true }).graph

    const groupGraph = getGroupNodes()
    expect(groupGraph).toHaveLength(1)
    compareGroup(groupGraph[0], 'group1', [
      { key: 'group1_n3', data: 'n3_data' },
      { key: 'group1_n2', data: 'n2_data' },
      { key: 'group1_n1', data: 'n1_data' },
    ])
  })

  describe('disjoint groups', () => {
    it('should split the group if there are dependencies', () => {
      origin.addNode('group1_n1', ['group1_n3'], 'n1_data')
      origin.addNode('group1_n2', ['group1_n3'], 'n2_data')
      origin.addNode('group1_n3', [], 'n3_data')
      subject = buildAcyclicGroupedGraph({
        source: origin,
        groupKey,
        disjointGroups: new Set(['group1']),
        shouldFailOnCircularDependency: true,
      }).graph

      const groupGraph = getGroupNodes()
      expect(groupGraph).toHaveLength(2)
      compareGroup(groupGraph[0], 'group1', [{ key: 'group1_n3', data: 'n3_data' }])
      compareGroup(groupGraph[1], 'group1', [
        { key: 'group1_n1', data: 'n1_data' },
        { key: 'group1_n2', data: 'n2_data' },
      ])
    })
    it('should not split the group if there are no dependencies', () => {
      origin.addNode('group1_n1', [], 'n1_data')
      origin.addNode('group1_n2', [], 'n2_data')
      origin.addNode('group1_n3', [], 'n3_data')
      subject = buildAcyclicGroupedGraph({
        source: origin,
        groupKey,
        disjointGroups: new Set(['group1']),
        shouldFailOnCircularDependency: true,
      }).graph

      const groupGraph = getGroupNodes()
      expect(groupGraph).toHaveLength(1)
      compareGroup(groupGraph[0], 'group1', [
        { key: 'group1_n1', data: 'n1_data' },
        { key: 'group1_n2', data: 'n2_data' },
        { key: 'group1_n3', data: 'n3_data' },
      ])
    })
    it('should split more than one group', () => {
      origin.addNode('group1_n1', [], 'n1_data')
      origin.addNode('group1_n2', ['group1_n1'], 'n2_data')
      origin.addNode('group2_n3', [], 'n3_data')
      origin.addNode('group2_n4', ['group2_n3'], 'n4_data')
      subject = buildAcyclicGroupedGraph({
        source: origin,
        groupKey,
        disjointGroups: new Set(['group1', 'group2']),
        shouldFailOnCircularDependency: true,
      }).graph

      const groupGraph = getGroupNodes()
      expect(groupGraph).toHaveLength(4)
      compareGroup(groupGraph[0], 'group1', [{ key: 'group1_n1', data: 'n1_data' }])
      compareGroup(groupGraph[1], 'group2', [{ key: 'group2_n3', data: 'n3_data' }])
      compareGroup(groupGraph[2], 'group1', [{ key: 'group1_n2', data: 'n2_data' }])
      compareGroup(groupGraph[3], 'group2', [{ key: 'group2_n4', data: 'n4_data' }])
    })
    it('should fail if there is a cycle', () => {
      origin.addNode('group1_n1', [], 'n1_data')
      origin.addNode('group1_n2', ['group1_n3'], 'n2_data')
      origin.addNode('group1_n3', ['group1_n2'], 'n3_data')
      expect(() =>
        buildAcyclicGroupedGraph({
          source: origin,
          groupKey,
          disjointGroups: new Set(['group1']),
          shouldFailOnCircularDependency: true,
        }),
      ).toThrow()
    })
  })

  describe('dependencies handling', () => {
    const buildSrcGraphAndGroupKeyFunc = (
      nodes: Record<string, string[]>,
      edges: Edge[],
    ): [DataNodeMap<string>, GroupKeyFunc] => {
      const groupIndex = new Map()
      const src = new DataNodeMap<string>()
      Object.entries(nodes).forEach(([groupId, nodeIds]) => {
        nodeIds.forEach(nodeId => {
          groupIndex.set(nodeId, groupId)
          src.addNode(nodeId, [], nodeId)
        })
      })
      edges.forEach(([from, to]) => src.addEdge(from, to))
      return [src, id => groupIndex.get(id) ?? id]
    }

    const verifyGroupGraphOrder = <T>(graph: GroupDAG<T>, edges: Edge[], maxSize: number): void => {
      let size = 0
      const seen = new Set()
      const nodeDeps = edges.reduce((acc, [from, to]) => {
        const currentDeps = acc.get(from) ?? new Set()
        currentDeps.add(to)
        acc.set(from, currentDeps)
        return acc
      }, new Map<NodeId, Set<NodeId>>())

      wu(graph.evaluationOrder()).forEach(gid => {
        size += 1
        const groupNodes = [...graph.getData(gid).items.keys()]
        groupNodes.forEach(nid => seen.add(nid))
        groupNodes.forEach(nid => {
          wu(nodeDeps.get(nid)?.keys() ?? []).forEach(id => {
            // This expext checks that all of the node predependencies were already met
            // if this fails - it means that the solution ignored the original order of
            // the nodes
            expect(seen.has(id)).toBeTruthy()
          })
        })
      })
      expect(size).toBeLessThanOrEqual(maxSize)
    }

    it('should be ok if there are no cycles', () => {
      const groups = {
        group1: ['n1', 'n2'],
        group2: ['n3', 'n4'],
      }

      const edges: Edge[] = [
        ['n1', 'n2'],
        ['n3', 'n4'],
      ]

      const [srcGraph, groupKeyFunc] = buildSrcGraphAndGroupKeyFunc(groups, edges)
      const groupGraph = buildAcyclicGroupedGraph({
        source: srcGraph,
        groupKey: groupKeyFunc,
        shouldFailOnCircularDependency: true,
      }).graph
      verifyGroupGraphOrder(groupGraph, edges, 2)
    })

    describe('when there is a cycle that can not be broken', () => {
      const groups = {
        group1: ['n1', 'n2'],
        group2: ['n3', 'n4'],
        group3: ['n5', 'n6'],
        group4: ['n7'],
        group5: ['n8'],
      }

      const edges: Edge[] = [
        // first cycle
        ['n2', 'n3'],
        ['n3', 'n4'],
        ['n4', 'n2'],

        // unrelated edges
        ['n1', 'n5'],

        // second cycle
        ['n7', 'n8'],
        ['n8', 'n7'],
      ]

      describe('when shouldFailOnCircularDependency is true', () => {
        it('should throw circular dependency error', () => {
          const [srcGraph, groupKeyFunc] = buildSrcGraphAndGroupKeyFunc(groups, edges)
          expect(() =>
            buildAcyclicGroupedGraph({
              source: srcGraph,
              groupKey: groupKeyFunc,
              shouldFailOnCircularDependency: true,
            }),
          ).toThrow()
        })
      })

      describe('when shouldFailOnCircularDependency false', () => {
        it('should remove the nodes that cause the cycle', () => {
          const [srcGraph, groupKeyFunc] = buildSrcGraphAndGroupKeyFunc(groups, edges)
          const { graph, removedCycles } = buildAcyclicGroupedGraph({
            source: srcGraph,
            groupKey: groupKeyFunc,
            shouldFailOnCircularDependency: false,
          })
          expect(removedCycles).toHaveLength(2)
          expect(removedCycles[0]).toEqual(['n1', 'n2', 'n3', 'n4'])
          expect(removedCycles[1]).toEqual(['n7', 'n8'])

          expect(graph.size).toEqual(1)
          expect(graph.nodeData.size).toEqual(1)
          expect(graph.edges().length).toEqual(0)
        })
      })
    })

    it('should ignore cycles whithin a single group', () => {
      const groups = {
        group1: ['n1', 'n2'],
        group2: ['n3', 'n4', 'n5'],
      }

      const edges: Edge[] = [
        ['n3', 'n4'],
        ['n4', 'n5'],
        ['n5', 'n3'],
      ]

      const [srcGraph, groupKeyFunc] = buildSrcGraphAndGroupKeyFunc(groups, edges)
      const groupGraph = buildAcyclicGroupedGraph({
        source: srcGraph,
        groupKey: groupKeyFunc,
        shouldFailOnCircularDependency: true,
      }).graph
      verifyGroupGraphOrder(groupGraph, edges, 2)
    })

    describe('spliting a group in order to prevent cycles', () => {
      it('should split a group when a single cycle exists (simple scenario)', () => {
        const groups = {
          group1: ['n1', 'n2'],
          group2: ['n3', 'n4'],
        }

        const edges: Edge[] = [
          ['n2', 'n3'],
          ['n4', 'n1'],
        ]

        const [srcGraph, groupKeyFunc] = buildSrcGraphAndGroupKeyFunc(groups, edges)
        const groupGraph = buildAcyclicGroupedGraph({
          source: srcGraph,
          groupKey: groupKeyFunc,
          shouldFailOnCircularDependency: true,
        }).graph
        verifyGroupGraphOrder(groupGraph, edges, 3)
      })

      it('should split groups which contain unrealated cycles', () => {
        const groups = {
          group1: ['n1', 'n2'],
          group2: ['n3', 'n4'],
          group3: ['n5', 'n6'],
          group4: ['n7', 'n8'],
        }

        const edges: Edge[] = [
          ['n2', 'n3'],
          ['n4', 'n1'],
          ['n6', 'n7'],
          ['n8', 'n6'],
        ]

        const [srcGraph, groupKeyFunc] = buildSrcGraphAndGroupKeyFunc(groups, edges)
        const groupGraph = buildAcyclicGroupedGraph({
          source: srcGraph,
          groupKey: groupKeyFunc,
          shouldFailOnCircularDependency: true,
        }).graph
        verifyGroupGraphOrder(groupGraph, edges, 6)
      })

      it('should split groups which contains multiple "parallel" cycles which need to be broken in different groups', () => {
        const groups = {
          group1: ['n1', 'n2', 'n3'],
          group2: ['n4', 'n5'],
          group3: ['n6', 'n7', 'n8'],
        }

        const edges: Edge[] = [
          // first
          ['n2', 'n4'],
          ['n4', 'n5'],
          ['n5', 'n7'],
          ['n7', 'n6'],
          ['n6', 'n1'],
          // /// second
          ['n3', 'n4'],
          ['n8', 'n3'],
        ]

        const [srcGraph, groupKeyFunc] = buildSrcGraphAndGroupKeyFunc(groups, edges)
        const groupGraph = buildAcyclicGroupedGraph({
          source: srcGraph,
          groupKey: groupKeyFunc,
          shouldFailOnCircularDependency: true,
        }).graph
        verifyGroupGraphOrder(groupGraph, edges, 6)
      })

      it('should split groups which contain cycles which shares edges', () => {
        const groups = {
          group1: ['n1', 'n2'],
          group2: ['n3'],
          group3: ['n4'],
          group4: ['n6', 'n7', 'n8'],
        }

        const edges: Edge[] = [
          ['n1', 'n3'],
          ['n2', 'n3'],
          ['n3', 'n4'],
          ['n4', 'n6'],
          ['n4', 'n7'],
          ['n8', 'n1'],
          ['n8', 'n2'],
        ]

        const [srcGraph, groupKeyFunc] = buildSrcGraphAndGroupKeyFunc(groups, edges)
        const groupGraph = buildAcyclicGroupedGraph({
          source: srcGraph,
          groupKey: groupKeyFunc,
          shouldFailOnCircularDependency: true,
        }).graph
        verifyGroupGraphOrder(groupGraph, edges, 6)
      })

      it('should split all nodes to the same new group when the breakable component contains multiple nodes', () => {
        const groups = {
          group1: ['n1'],
          group2: ['n2', 'n3', 'n4', 'n5'],
        }

        const edges: Edge[] = [
          ['n1', 'n2'],
          ['n2', 'n3'],
          ['n4', 'n5'],
          ['n5', 'n1'],
        ]

        const [srcGraph, groupKeyFunc] = buildSrcGraphAndGroupKeyFunc(groups, edges)
        const groupGraph = buildAcyclicGroupedGraph({
          source: srcGraph,
          groupKey: groupKeyFunc,
          shouldFailOnCircularDependency: true,
        }).graph
        verifyGroupGraphOrder(groupGraph, edges, 3)
      })

      it('should split a cycle when one of the groups contain a cycle which is not a splitable component', () => {
        const groups = {
          group1: ['n1', 'n2', 'n3'],
          group2: ['n4', 'n5'],
        }

        const edges: Edge[] = [
          ['n1', 'n2'],
          ['n2', 'n1'],
          ['n1', 'n3'],
          ['n3', 'n4'],
          ['n5', 'n1'],
        ]

        const [srcGraph, groupKeyFunc] = buildSrcGraphAndGroupKeyFunc(groups, edges)
        const groupGraph = buildAcyclicGroupedGraph({
          source: srcGraph,
          groupKey: groupKeyFunc,
          shouldFailOnCircularDependency: true,
        }).graph
        verifyGroupGraphOrder(groupGraph, edges, 3)
      })

      it('should handle complex scenarios', () => {
        const groups = {
          group1: ['n1', 'n2', 'n3', 'n4'],
          group2: ['n5', 'n6'],
          group3: ['n7', 'n8'],
          group4: ['n9', 'n10'],
        }

        const edges: Edge[] = [
          ['n1', 'n3'],
          ['n2', 'n3'],
          ['n3', 'n8'],
          ['n4', 'n5'],
          ['n5', 'n2'],
          ['n6', 'n2'],
          ['n7', 'n1'],
          ['n8', 'n9'],
          ['n10', 'n6'],
        ]

        const [srcGraph, groupKeyFunc] = buildSrcGraphAndGroupKeyFunc(groups, edges)
        const groupGraph = buildAcyclicGroupedGraph({
          source: srcGraph,
          groupKey: groupKeyFunc,
          shouldFailOnCircularDependency: true,
        }).graph
        verifyGroupGraphOrder(groupGraph, edges, 7)
      })
    })
  })
})
