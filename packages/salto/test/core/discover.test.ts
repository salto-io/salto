import {
  ElemID, Field, BuiltinTypes, ObjectType, getChangeElement, Adapter, Element,
} from 'adapter-api'
import { getUpstreamChanges, discoverChanges, ChangeWithConflict } from '../../src/core/discover'
import { DetailedChange } from '../../src/core/plan'

describe('discover', () => {
  const testID = new ElemID('dummy', 'elem')
  const testField = new Field(testID, 'test', BuiltinTypes.STRING, { annotation: 'value' })
  const typeWithoutField = new ObjectType({
    elemID: testID,
    fields: {},
  })
  const typeWithField = new ObjectType({
    elemID: testID,
    fields: { test: testField },
  })
  const typeWithFieldChange = typeWithField.clone()
  typeWithFieldChange.fields.test.annotations.annotation = 'changed'
  const typeWithFieldConflict = typeWithField.clone()
  typeWithFieldConflict.fields.test.annotations.annotation = 'conflict'
  const newTypeID = new ElemID('dummy', 'new')
  const newTypeBase = new ObjectType({
    elemID: newTypeID,
    fields: { base: new Field(newTypeID, 'base', BuiltinTypes.STRING) },
  })
  newTypeBase.path = ['path', 'base']
  const newTypeExt = new ObjectType({
    elemID: newTypeID,
    fields: { ext: new Field(newTypeID, 'ext', BuiltinTypes.STRING) },
  })
  newTypeExt.path = ['path', 'ext']
  const newTypeMerged = new ObjectType({
    elemID: newTypeID,
    fields: {
      base: new Field(newTypeID, 'base', BuiltinTypes.STRING),
      ext: new Field(newTypeID, 'ext', BuiltinTypes.STRING),
    },
  })

  describe('getUpstreamChanges', () => {
    let changes: DetailedChange[]
    beforeEach(() => {
      changes = [
        ...getUpstreamChanges(
          [typeWithoutField],
          [typeWithField, newTypeBase, newTypeExt],
          [typeWithField, newTypeMerged],
        ),
      ]
    })

    it('should return field addition change', () => {
      expect(
        changes.map(change => change.id.getFullName())
      ).toContain(testField.elemID.getFullName())
    })

    describe('type addition changes', () => {
      let typeAdditions: DetailedChange[]
      beforeEach(() => {
        typeAdditions = changes.filter(
          change => change.id.getFullName() === newTypeID.getFullName()
        )
      })
      it('should return separate changes according to the input elements', () => {
        expect(typeAdditions).toHaveLength(2)
      })
      it('should have path hint', () => {
        expect(typeAdditions.map(change => getChangeElement(change).path).sort()).toEqual([
          ['path', 'base'],
          ['path', 'ext'],
        ])
      })
    })
  })

  describe('discoverChanges', () => {
    const mockAdapters = {
      dummy: {
        discover: jest.fn().mockResolvedValue(Promise.resolve([])),
      },
    }
    let changes: ChangeWithConflict[]
    describe('when the adapter returns elements with merge errors', () => {
      beforeEach(() => {
        mockAdapters.dummy.discover.mockResolvedValueOnce(
          Promise.resolve([newTypeBase, newTypeBase]),
        )
      })
      it('should fail', async () => {
        await expect(discoverChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [],
          [],
        )).rejects.toThrow()
      })
    })
    describe('when there are no changes', () => {
      let elements: Element[]
      beforeEach(async () => {
        mockAdapters.dummy.discover.mockResolvedValueOnce(
          Promise.resolve([newTypeBase, newTypeExt]),
        )
        const result = await discoverChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [newTypeMerged],
          [newTypeMerged],
        )
        elements = result.elements
        changes = [...result.changes]
      })
      it('should return merged elements', () => {
        expect(elements).toHaveLength(1)
      })
      it('should not return changes', () => {
        expect(changes).toHaveLength(0)
      })
    })
    describe('when the change is only in the service', () => {
      beforeEach(async () => {
        mockAdapters.dummy.discover.mockResolvedValueOnce(
          Promise.resolve([typeWithFieldChange])
        )
        const result = await discoverChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [typeWithField],
          [typeWithField],
        )
        changes = [...result.changes]
      })
      it('should return the change with no conflict', () => {
        expect(changes).toHaveLength(1)
        expect(changes[0].localChange).toBeUndefined()
      })
    })
    describe('when the working copy is already the same as the service', () => {
      beforeEach(async () => {
        mockAdapters.dummy.discover.mockResolvedValueOnce(
          Promise.resolve([typeWithFieldChange])
        )
        const result = await discoverChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [typeWithFieldChange],
          [typeWithField],
        )
        changes = [...result.changes]
      })
      it('should not return any change', () => {
        expect(changes).toHaveLength(0)
      })
    })
    describe('when the working copy has a conflicting change', () => {
      beforeEach(async () => {
        mockAdapters.dummy.discover.mockResolvedValueOnce(
          Promise.resolve([typeWithFieldChange])
        )
        const result = await discoverChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [typeWithFieldConflict],
          [typeWithField],
        )
        changes = [...result.changes]
      })
      it('should return the change with the conflict', () => {
        expect(changes).toHaveLength(1)
        expect(changes[0].localChange).toBeDefined()
      })
    })
    describe('when the changed element is removed in the working copy', () => {
      beforeEach(async () => {
        mockAdapters.dummy.discover.mockResolvedValueOnce(
          Promise.resolve([typeWithFieldChange])
        )
        const result = await discoverChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [],
          [typeWithField],
        )
        changes = [...result.changes]
      })
      it('should return only one change', () => {
        expect(changes).toHaveLength(1)
      })
      describe('returned change', () => {
        let change: ChangeWithConflict
        beforeEach(() => {
          [change] = changes
        })
        it('should contain the service change', () => {
          expect(change.serviceChange.action).toEqual('modify')
        })
        it('should contain the local change', () => {
          expect(change.localChange).toBeDefined()
          if (change.localChange) { // If only here to help typescript compiler
            expect(change.localChange.action).toEqual('remove')
          }
        })
        it('should have the change that syncs the working copy to the service', () => {
          expect(change.change.action).toEqual('add')
        })
      })
    })
  })
})
