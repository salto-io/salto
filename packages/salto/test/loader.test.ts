import {
  ObjectType, ElemID, Field, BuiltinTypes, InstanceElement, PrimitiveType,
  PrimitiveTypes, Type,
} from 'adapter-api'
import { mergeElements, UPDATE_KEYWORD } from '../src/core/merger'

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
    annotations: {
      _default: {
        field1: 'base1',
        field2: 'base2',
      },
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
    annotationsDescriptor: {
      anno1: BuiltinTypes.STRING,
    },
  })

  const multipleUpdateAnno = new ObjectType({
    elemID: baseElemID,
    fields: {},
    annotationsDescriptor: {
      anno1: BuiltinTypes.STRING,
    },
  })

  const updateAnnoValues = new ObjectType({
    elemID: baseElemID,
    fields: {},
    annotations: {
      anno1: 'updated',
    },
  })

  const multipleUpdateAnnoValues = new ObjectType({
    elemID: baseElemID,
    fields: {},
    annotations: {
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
  const instanceElement2 = new InstanceElement(new ElemID('salto', 'inst2'), unrelated, {})

  const mergedObject = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: new Field(baseElemID, 'field1', BuiltinTypes.STRING, { label: 'update1' }),
      field2: new Field(baseElemID, 'field2', BuiltinTypes.STRING, { label: 'update2' }),
    },
    annotations: {
      anno1: 'updated',
      _default: {
        field1: 'base1',
        field2: 'base2',
      },
    },
    annotationsDescriptor: {
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

  describe('merging instances', () => {
    const strType = new PrimitiveType({
      elemID: new ElemID('salto', 'string'),
      primitive: PrimitiveTypes.STRING,
      annotations: { _default: 'type' },
    })
    const nestedElemID = new ElemID('salto', 'nested')
    const nested = new ObjectType({
      elemID: nestedElemID,
      fields: {
        field1: new Field(nestedElemID, 'field1', strType, { _default: 'field1' }),
        field2: new Field(nestedElemID, 'field2', strType),
        base: new Field(nestedElemID, 'field2', base),
      },
    })
    const ins1 = new InstanceElement(new ElemID('salto', 'ins'), nested, {
      field1: 'ins1',
      field2: 'ins1',
    })
    const ins2 = new InstanceElement(new ElemID('salto', 'ins'), nested, {
      base: {
        field1: 'ins2',
        field2: 'ins2',
      },
    })
    const shouldUseFieldDef = new InstanceElement(new ElemID('salto', 'ins'), nested, {
      field2: 'ins1',
    })
    const shouldUseTypeDef = new InstanceElement(new ElemID('salto', 'ins'), nested, {
      field1: 'ins1',
    })

    it('should merge instances', () => {
      const elements = [ins1, ins2]
      const merged = mergeElements(elements)
      expect(merged.length).toBe(1)
      const ins = merged[0] as InstanceElement
      expect(ins.value).toEqual({
        field1: 'ins1',
        field2: 'ins1',
        base: {
          field1: 'ins2',
          field2: 'ins2',
        },
      })
    })

    it('should use field defaults', () => {
      const elements = [shouldUseFieldDef, ins2]
      const merged = mergeElements(elements)
      const ins = merged[0] as InstanceElement
      expect(ins.value).toEqual({
        field1: 'field1',
        field2: 'ins1',
        base: {
          field1: 'ins2',
          field2: 'ins2',
        },
      })
    })

    it('should use type defaults', () => {
      const elements = [shouldUseTypeDef, ins2]
      const merged = mergeElements(elements)
      const ins = merged[0] as InstanceElement
      expect(ins.value).toEqual({
        field1: 'ins1',
        field2: 'type',
        base: {
          field1: 'ins2',
          field2: 'ins2',
        },
      })
    })

    it('should use object defaults', () => {
      const elements = [ins1]
      const merged = mergeElements(elements)
      const ins = merged[0] as InstanceElement
      expect(ins.value).toEqual({
        field1: 'ins1',
        field2: 'ins1',
        base: {
          field1: 'base1',
          field2: 'base2',
        },
      })
    })

    it('should fail on multiple values for same key', () => {
      const elements = [ins1, shouldUseFieldDef]
      expect(() => mergeElements(elements)).toThrow()
    })
  })

  describe('merging primitives', () => {
    const strType = new PrimitiveType({
      elemID: new ElemID('salto', 'string'),
      primitive: PrimitiveTypes.STRING,
      annotations: { _default: 'type' },
    })

    const duplicateType = new PrimitiveType({
      elemID: new ElemID('salto', 'string'),
      primitive: PrimitiveTypes.STRING,
      annotations: { _default: 'type' },
    })
    it('should fail when more then one primitive is defined with same elemID', () => {
      const elements = [strType, duplicateType]
      expect(() => mergeElements(elements)).toThrow()
    })
  })

  describe('replace type defs', () => {
    const typeRef = (typeToRef: Type): ObjectType => new ObjectType({ elemID: typeToRef.elemID })

    const strType = new PrimitiveType({
      elemID: new ElemID('salto', 'string'),
      primitive: PrimitiveTypes.STRING,
      annotations: { _default: 'type' },
    })

    const nestedElemID = new ElemID('salto', 'nested')

    const nested = new ObjectType({
      elemID: nestedElemID,
      fields: {
        prim: new Field(nestedElemID, 'field2', typeRef(strType)),
        base: new Field(nestedElemID, 'field2', typeRef(base)),
      },
    })

    it('should replace type refs with full types', () => {
      const elements = mergeElements([
        strType,
        base,
        nested,
      ])
      const element = elements[2] as ObjectType
      expect(element.fields.prim.type).toEqual(strType)
      expect(element.fields.base.type).toEqual(base)
    })
  })
})
