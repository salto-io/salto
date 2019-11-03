import {
  ElemID, Field, BuiltinTypes, ObjectType, getChangeElement, Adapter, Element,
} from 'adapter-api'
import {
  fetchChanges,
  FetchChange,
} from '../../src/core/fetch'

describe('fetch', () => {
  const testID = new ElemID('dummy', 'elem')
  const testField = new Field(testID, 'test', BuiltinTypes.STRING, { annotation: 'value' })
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

  describe('fetchChanges', () => {
    const mockAdapters = {
      dummy: {
        fetch: jest.fn().mockResolvedValue(Promise.resolve([])),
      },
    }
    let changes: FetchChange[]
    describe('when the adapter returns elements with merge errors', () => {
      beforeEach(() => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve([newTypeBase, newTypeBase]),
        )
      })
      it('should fail', async () => {
        await expect(fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [],
          [],
        )).rejects.toThrow()
      })
    })
    describe('when there are no changes', () => {
      let elements: Element[]
      beforeEach(async () => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve([newTypeBase, newTypeExt]),
        )
        const result = await fetchChanges(
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
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve([typeWithFieldChange])
        )
        const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [typeWithField],
          [typeWithField],
        )
        changes = [...result.changes]
      })
      it('should return the change with no conflict', () => {
        expect(changes).toHaveLength(1)
        expect(changes[0].pendingChange).toBeUndefined()
      })
    })
    describe('when the adapter returns elements that should be split', () => {
      beforeEach(async () => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve([newTypeBase, newTypeExt])
        )
        const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [],
          [],
        )
        changes = [...result.changes]
      })
      it('should return separate changes according to the input elements', () => {
        expect(changes).toHaveLength(2)
      })
      it('should have path hint for new elements', () => {
        expect(changes.map(change => getChangeElement(change.change).path).sort()).toEqual([
          ['path', 'base'],
          ['path', 'ext'],
        ])
      })
    })
    describe('when the working copy is already the same as the service', () => {
      beforeEach(async () => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve([typeWithFieldChange])
        )
        const result = await fetchChanges(
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
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve([typeWithFieldChange])
        )
        const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [typeWithFieldConflict],
          [typeWithField],
        )
        changes = [...result.changes]
      })
      it('should return the change with the conflict', () => {
        expect(changes).toHaveLength(1)
        expect(changes[0].pendingChange).toBeDefined()
      })
    })
    describe('when the changed element is removed in the working copy', () => {
      beforeEach(async () => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve([typeWithFieldChange])
        )
        const result = await fetchChanges(
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
        let change: FetchChange
        beforeEach(() => {
          [change] = changes
        })
        it('should contain the service change', () => {
          expect(change.serviceChange.action).toEqual('modify')
        })
        it('should contain the local change', () => {
          expect(change.pendingChange).toBeDefined()
          if (change.pendingChange) { // If only here to help typescript compiler
            expect(change.pendingChange.action).toEqual('remove')
          }
        })
        it('should have the change that syncs the working copy to the service', () => {
          expect(change.change.action).toEqual('add')
        })
      })
    })
  })
})
