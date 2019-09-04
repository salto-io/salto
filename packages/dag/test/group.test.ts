import { isString } from 'util'
import { buildGroupedGraph, GroupedNodeMap, Group } from '../src/group'
import { DataNodeMap } from '../src/nodemap'
import { SetId } from '../src/set'

describe('buildGroupGraph', () => {
  let subject: GroupedNodeMap<string>
  const origin = new DataNodeMap<string>()
  const groupKey = (name: SetId): string => (isString(name) ? name.split('_')[0] : '')

  beforeEach(() => {
    origin.clear()
  })

  const getGroupNodes = (): Group<string>[] => [...subject.evaluationOrder()]
    .map(groupId => subject.getData(groupId) as Group<string>)

  const compareGroup = (group: Group<string>, key: string, items: {key: string; data: string}[]):
  void => {
    expect(group.groupKey).toBe(key)
    expect(group.items.size).toBe(items.length)
    items.forEach(item => expect(group.items.get(item.key)).toBe(item.data))
  }

  it('should return empty group graph for empty origin', () => {
    subject = buildGroupedGraph(origin, groupKey)
    expect(getGroupNodes()).toEqual([])
  })

  it('should create group for each element in origin', () => {
    origin.addNode('n1', ['n2', 'n3'], 'n1_data')
    origin.addNode('n2', ['n3'], 'n2_data')
    origin.addNode('n3', [], 'n3_data')
    subject = buildGroupedGraph(origin, groupKey)

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
    subject = buildGroupedGraph(origin, groupKey)

    const groupGraph = getGroupNodes()
    expect(groupGraph).toHaveLength(1)
    compareGroup(groupGraph[0], 'group1', [{ key: 'group1_n3', data: 'n3_data' },
      { key: 'group1_n2', data: 'n2_data' }, { key: 'group1_n1', data: 'n1_data' }])
  })

  it('should divide groupkey to multiple nodes due to dependency', () => {
    origin.addNode('group1_n1', ['group2_n3'], 'n1_data')
    origin.addNode('group1_n2', [], 'n2_data')
    origin.addNode('group2_n3', [], 'n3_data')
    origin.addNode('group2_n4', ['group1_n2'], 'n4_data')

    subject = buildGroupedGraph(origin, groupKey)

    const groupGraph = getGroupNodes()
    expect(groupGraph).toHaveLength(3)
    compareGroup(groupGraph[0], 'group2', [{ key: 'group2_n3', data: 'n3_data' }])
    compareGroup(groupGraph[1], 'group1', [{ key: 'group1_n2', data: 'n2_data' },
      { key: 'group1_n1', data: 'n1_data' }])
    compareGroup(groupGraph[2], 'group2', [{ key: 'group2_n4', data: 'n4_data' }])
  })
})
