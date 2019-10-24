import {
  ElemID, Field, BuiltinTypes, ObjectType, getChangeElement, Element,
} from 'adapter-api'
import { getUpstreamChanges } from '../../src/core/discover'
import { DetailedChange } from '../../src/core/plan'

describe('discover', () => {
  describe('getUpstreamChanges', () => {
    const testID = new ElemID('dummy', 'elem')
    const testField = new Field(testID, 'test', BuiltinTypes.STRING)
    const typeWithoutField = new ObjectType({
      elemID: testID,
      fields: {},
    })
    const typeWithField = new ObjectType({
      elemID: testID,
      fields: { test: testField },
    })
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

    describe('with valid input', () => {
      let elements: Element[]
      let changes: DetailedChange[]
      beforeEach(() => {
        const result = getUpstreamChanges(
          [typeWithoutField],
          [typeWithField, newTypeBase, newTypeExt],
        )
        elements = result.elements
        changes = [...result.changes]
      })

      describe('returned elements', () => {
        it('should be merged', () => {
          expect(elements).toHaveLength(2)
        })
      })

      describe('returned changes', () => {
        it('should contain field addition change', () => {
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
    })
    describe('with invalid upstream elements', () => {
      it('should fail', () => {
        expect(() => getUpstreamChanges([], [newTypeBase, newTypeBase])).toThrow()
      })
    })
  })
})
