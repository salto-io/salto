import {
  ObjectType, ElemID, Field, BuiltinTypes, InstanceElement,
} from 'adapter-api'
import { mergeElements, UPDATE_KEYWORD } from '../src/blueprints/loader'

describe('Loader merging ability', () => {
  const updateType = new ObjectType(
    { elemID: new ElemID('', UPDATE_KEYWORD) }
  )
  const baseElemID = new ElemID('salto', 'base')
  const base = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: new Field(baseElemID, 'field1', BuiltinTypes.STRING, { label: 'base' }),
      field2: new Field(baseElemID, 'field2', BuiltinTypes.STRING, { label: 'base' }),
    },
  })

  const unrelated = new ObjectType({
    elemID: new ElemID('salto', 'unrelated'),
    fields: {
      field1: new Field(baseElemID, 'field1', BuiltinTypes.STRING, { label: 'base' }),
    },
  })

  const update1 = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: new Field(baseElemID, 'field1', updateType, { label: 'update1' }),
    },
  })

  const update2 = new ObjectType({
    elemID: baseElemID,
    fields: {
      field2: new Field(baseElemID, 'field2', updateType, { label: 'update2' }),
    },
  })

  const updateAnno = new ObjectType({
    elemID: baseElemID,
    fields: {},
    annotations: {
      anno1: BuiltinTypes.STRING,
    },
  })

  const multipleUpdateAnno = new ObjectType({
    elemID: baseElemID,
    fields: {},
    annotations: {
      anno1: BuiltinTypes.STRING,
    },
  })

  const updateAnnoValues = new ObjectType({
    elemID: baseElemID,
    fields: {},
    annotationsValues: {
      anno1: 'updated',
    },
  })

  const multipleUpdateAnnoValues = new ObjectType({
    elemID: baseElemID,
    fields: {},
    annotationsValues: {
      anno1: 'updated',
    },
  })

  const multipleUpdate1 = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: new Field(baseElemID, 'field1', updateType, { label: 'update1' }),
    },
  })

  const missingUpdate = new ObjectType({
    elemID: baseElemID,
    fields: {
      field3: new Field(baseElemID, 'field3', updateType, { label: 'update3' }),
    },
  })

  const multipleBase = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: new Field(baseElemID, 'field1', BuiltinTypes.STRING, { label: 'base' }),
    },
  })

  const instanceElement = new InstanceElement(new ElemID('salto', 'inst'), base, {})
  const instanceElement2 = new InstanceElement(new ElemID('salto', 'inst2'), BuiltinTypes.STRING, {})

  const mergedObject = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: new Field(baseElemID, 'field1', BuiltinTypes.STRING, { label: 'update1' }),
      field2: new Field(baseElemID, 'field2', BuiltinTypes.STRING, { label: 'update2' }),
    },
    annotationsValues: {
      anno1: 'updated',
    },
    annotations: {
      anno1: BuiltinTypes.STRING,
    },
  })


  describe('merging updates', () => {
    it('does not modify an element list with no updates', () => {
      const elements = [base, unrelated]
      const merged = mergeElements(elements)
      expect(merged.length).toBe(2)
    })

    it('merges multiple update fields blocks', () => {
      const elements = [
        base,
        unrelated,
        update1,
        update2,
        updateAnno,
        updateAnnoValues,
      ]
      const merged = mergeElements(elements)
      expect(merged.length).toBe(2)
      expect(merged[0]).toEqual(mergedObject)
    })

    it('yeilds the same result regardless of the elements order', () => {
      const elements = [
        update1,
        updateAnno,
        base,
        unrelated,
        update2,
        updateAnnoValues,
      ]
      const merged = mergeElements(elements)
      expect(merged.length).toBe(2)
      expect(merged[0]).toEqual(mergedObject)
    })

    it('throws error when multiple updates exists for same field', () => {
      const elements = [
        base,
        update1,
        multipleUpdate1,
      ]
      expect(() => mergeElements(elements)).toThrow()
    })

    it('throws error when attempting to update a no existing field', () => {
      const elements = [
        base,
        missingUpdate,
      ]
      expect(() => mergeElements(elements)).toThrow()
    })

    it('throws error when multiple updates exists for same annotation', () => {
      const elements = [
        base,
        updateAnno,
        multipleUpdateAnno,
      ]
      expect(() => mergeElements(elements)).toThrow()
    })

    it('throws error when multiple updates exists for same annotation value', () => {
      const elements = [
        base,
        updateAnnoValues,
        multipleUpdateAnnoValues,
      ]
      expect(() => mergeElements(elements)).toThrow()
    })

    it('throws error when multiple base field definitions', () => {
      const elements = [
        base,
        multipleBase,
      ]
      expect(() => mergeElements(elements)).toThrow()
    })
  })

  describe('merging placeholders', () => {
    it('update type pointers with the modified type', () => {
      const elements = [
        base,
        unrelated,
        update1,
        update2,
        updateAnno,
        updateAnnoValues,
        instanceElement,
        instanceElement2,
      ]
      const merged = mergeElements(elements)
      expect(merged.length).toBe(4)
    })
  })
})
