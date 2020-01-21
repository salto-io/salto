// import { collections } from '@salto/lowerdash'
// import {
//   removeEqualNodes, mergeNodesToModify, DiffGraph, DiffNode,
// } from '../src/diff'
// import { DataNodeMap } from '../src/nodemap'

// const { equals: setEquals } = collections.set

describe('DiffGraph functions', () => {
  describe('removeEqualNodes', () => {
    // TODO:ORI - test
    it('dummy', () => {
      expect(true).toBe(true)
    })
  })

  describe('mergeNodesToModify', () => {
    // TODO:ORI - test
    it('dummy', () => {
      expect(true).toBe(true)
    })
  })

  // const before = new DataNodeMap<string>()
  // const after = new DataNodeMap<string>()

  // beforeEach(() => {
  //   before.clear()
  //   after.clear()
  // })

  // const depsEqual = (n: collections.set.SetId): boolean => setEquals(before.get(n), after.get(n))
  // const getDiffNodes = (): DiffNode<string>[] => [...subject.evaluationOrder()]
  //   .map(diffNodeId => subject.getData(diffNodeId) as DiffNode<string>)

  // describe('given an empty "before" graph', () => {
  //   beforeEach(() => {
  //     after.addNode(2, [], 'n2')
  //     after.addNode(3, [], 'n3')
  //     after.addNode(1, [2, 3], 'n1')

  //     subject = buildDiffGraph(before, after, _n => false)
  //   })

  //   it('should return a diff graph that builds the "after" graph', () => {
  //     expect(getDiffNodes()).toEqual([
  //       { action: 'add', originalId: 2, data: { after: 'n2' } },
  //       { action: 'add', originalId: 3, data: { after: 'n3' } },
  //       { action: 'add', originalId: 1, data: { after: 'n1' } },
  //     ])
  //   })
  // })

  // describe('given an empty "after" graph', () => {
  //   beforeEach(() => {
  //     before.addNode(2, [], 'n2')
  //     before.addNode(3, [], 'n3')
  //     before.addNode(1, [2, 3], 'n1')
  //     subject = buildDiffGraph(before, after, _n => false)
  //   })

  //   it('should return a diff graph that deletes the "before" graph', () => {
  //     expect(getDiffNodes()).toEqual([
  //       { action: 'remove', originalId: 1, data: { before: 'n1' } },
  //       { action: 'remove', originalId: 2, data: { before: 'n2' } },
  //       { action: 'remove', originalId: 3, data: { before: 'n3' } },
  //     ])
  //   })
  // })

  // describe('given identical "before" and "after" graphs', () => {
  //   beforeEach(() => {
  //     before.addNode(2, [], 'n2')
  //     before.addNode(3, [], 'n3')
  //     before.addNode(1, [2, 3], 'n1')
  //     after.addNode(2, [], 'n2')
  //     after.addNode(3, [], 'n3')
  //     after.addNode(1, [2, 3], 'n1')

  //     subject = buildDiffGraph(before, after, _n => true)
  //   })

  //   it('returns an empty diff graph', () => {
  //     expect(getDiffNodes()).toEqual([])
  //   })
  // })

  // describe('when a node is not equal and can be modified', () => {
  //   beforeEach(() => {
  //     before.addNode(1, [2], 'n1')
  //     before.addNode(2, [], 'n2')
  //     after.addNode(1, [2], 'n1t')
  //     after.addNode(2, [], 'n2')

  //     subject = buildDiffGraph(before, after, n => n === 2)
  //   })

  //   it('should return a modification', () => {
  //     expect(getDiffNodes()).toEqual([
  //       { action: 'modify', originalId: 1, data: { before: 'n1', after: 'n1t' } },
  //     ])
  //   })
  // })

  // describe('when a modification needs to be broken up into addition and removal', () => {
  //   beforeEach(() => {
  //     before.addNode(2, [], 'n2')
  //     before.addNode(1, [2], 'n1')
  //     after.addNode(2, [], 'n2t')
  //     after.addNode(1, [2], 'n1')

  //     subject = buildDiffGraph(before, after, _n => false)
  //   })

  //   it('should break up the modification', () => {
  //     expect(getDiffNodes()).toEqual([
  //       { action: 'remove', originalId: 1, data: { before: 'n1' } },
  //       { action: 'modify', originalId: 2, data: { before: 'n2', after: 'n2t' } },
  //       { action: 'add', originalId: 1, data: { after: 'n1' } },
  //     ])
  //   })
  // })

  // describe('given two graphs with data', () => {
  //   beforeEach(() => {
  //     before.addNode(1, [2], 'n1')
  //     before.addNode(2, [3, 4], 'n2')
  //     before.addNode(3, [], 'n3')
  //     before.addNode(4, [5, 6], 'n4')
  //     before.addNode(5, [], 'n5')
  //     before.addNode(6, [], 'n6')

  //     after.addNode(1, [4, 6], 'n1')
  //     after.addNode(4, [5, 7], 'n4')
  //     after.addNode(5, [], 'n5')
  //     after.addNode(6, [], 'n6')
  //     after.addNode(7, [], 'n7')

  //     subject = buildDiffGraph(before, after, depsEqual)
  //   })

  //   it('should break up the modification', () => {
  //     expect(getDiffNodes()).toEqual([
  //       { action: 'remove', originalId: 1, data: { before: 'n1' } },
  //       { action: 'add', originalId: 7, data: { after: 'n7' } },
  //       { action: 'remove', originalId: 2, data: { before: 'n2' } },
  //       { action: 'remove', originalId: 3, data: { before: 'n3' } },
  //       { action: 'modify', originalId: 4, data: { before: 'n4', after: 'n4' } },
  //       { action: 'add', originalId: 1, data: { after: 'n1' } },
  //     ])
  //   })
  // })
})
