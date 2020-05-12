/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  ObjectType, ElemID, BuiltinTypes, InstanceElement, PrimitiveType,
  PrimitiveTypes, TypeElement, Variable,
} from '@salto-io/adapter-api'
import {
  mergeElements,
  DuplicateAnnotationTypeError, DuplicateVariableNameError, ConflictingFieldTypesError,
  DuplicateAnnotationError, DuplicateAnnotationFieldDefinitionError, DuplicateInstanceKeyError,
  MultiplePrimitiveTypesUnsupportedError,
} from '../src/core/merger'

describe('merger', () => {
  const baseElemID = new ElemID('salto', 'base')
  const base = new ObjectType({
    elemID: baseElemID,
    fields: [
      { name: 'field1', type: BuiltinTypes.STRING, annotations: { label: 'base' } },
      { name: 'field2', type: BuiltinTypes.STRING, annotations: { label: 'base' } },
    ],
    annotations: {
      _default: {
        field1: 'base1',
        field2: 'base2',
      },
    },
  })

  const unrelated = new ObjectType({
    elemID: new ElemID('salto', 'unrelated'),
    fields: [
      { name: 'field1', type: BuiltinTypes.STRING, annotations: { label: 'base' } },
    ],
  })

  const fieldAnnotationConflict = new ObjectType({
    elemID: baseElemID,
    fields: [
      { name: 'field1', type: BuiltinTypes.STRING, annotations: { label: 'update1' } },
    ],
  })

  const fieldTypeConflict = new ObjectType({
    elemID: baseElemID,
    fields: [
      { name: 'field2', type: BuiltinTypes.NUMBER },
    ],
  })

  const fieldUpdate = new ObjectType({
    elemID: baseElemID,
    fields: [
      { name: 'field1', type: BuiltinTypes.STRING, annotations: { a: 'update' } },
    ],
  })

  const fieldUpdate2 = new ObjectType({
    elemID: baseElemID,
    fields: [
      { name: 'field1', type: BuiltinTypes.STRING, annotations: { b: 'update' } },
    ],
  })

  const newField = new ObjectType({
    elemID: baseElemID,
    fields: [
      { name: 'field3', type: BuiltinTypes.STRING },
    ],
  })

  const updateAnno = new ObjectType({
    elemID: baseElemID,
    annotationTypes: {
      anno1: BuiltinTypes.STRING,
    },
  })

  const multipleUpdateAnno = new ObjectType({
    elemID: baseElemID,
    annotationTypes: {
      anno1: BuiltinTypes.STRING,
    },
  })

  const updateAnnoValues = new ObjectType({
    elemID: baseElemID,
    annotations: {
      anno1: 'updated',
    },
  })

  const multipleUpdateAnnoValues = new ObjectType({
    elemID: baseElemID,
    annotations: {
      anno1: 'updated',
    },
  })

  const instanceElement = new InstanceElement('inst', base, {})
  const instanceElement2 = new InstanceElement('inst2', unrelated, {})

  const mergedObject = new ObjectType({
    elemID: baseElemID,
    fields: [
      { name: 'field1', type: BuiltinTypes.STRING, annotations: { label: 'base', a: 'update', b: 'update' } },
      { name: 'field2', type: BuiltinTypes.STRING, annotations: { label: 'base' } },
      { name: 'field3', type: BuiltinTypes.STRING },
    ],
    annotations: {
      anno1: 'updated',
      _default: {
        field1: 'base1',
        field2: 'base2',
      },
    },
    annotationTypes: {
      anno1: BuiltinTypes.STRING,
    },
  })

  describe('updates', () => {
    it('does not modify an element list with no updates', () => {
      const elements = [base, unrelated]
      const { merged, errors } = mergeElements(elements)
      expect(errors).toHaveLength(0)
      expect(merged).toHaveLength(2)
    })

    it('merges multiple field blocks', () => {
      const elements = [
        base,
        unrelated,
        fieldUpdate,
        fieldUpdate2,
        newField,
        updateAnno,
        updateAnnoValues,
      ]
      const { merged, errors } = mergeElements(elements)
      expect(errors).toHaveLength(0)
      expect(merged).toHaveLength(2)
      expect(merged[0]).toEqual(mergedObject)
    })

    it('returns the same result regardless of the elements order', () => {
      const elements = [
        fieldUpdate,
        updateAnno,
        newField,
        base,
        unrelated,
        fieldUpdate2,
        updateAnnoValues,
      ]
      const { merged, errors } = mergeElements(elements)
      expect(errors).toHaveLength(0)
      expect(merged).toHaveLength(2)
      expect(merged[0]).toEqual(mergedObject)
    })

    it('returns an error when the same field annotation is defined multiple times', () => {
      const elements = [
        base,
        fieldAnnotationConflict,
      ]
      const { errors } = mergeElements(elements)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateAnnotationFieldDefinitionError)
    })

    it('returns an error when multiple updates exists for same annotation', () => {
      const elements = [
        base,
        updateAnno,
        multipleUpdateAnno,
      ]
      const { errors } = mergeElements(elements)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateAnnotationTypeError)
    })

    it('returns an error when multiple updates exists for same annotation value', () => {
      const elements = [
        base,
        updateAnnoValues,
        multipleUpdateAnnoValues,
      ]
      const { errors } = mergeElements(elements)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateAnnotationError)
    })

    it('returns an error when field definitions have conflicting types', () => {
      const elements = [
        base,
        fieldTypeConflict,
      ]
      const { errors } = mergeElements(elements)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(ConflictingFieldTypesError)
      expect(errors[0].message).toContain(BuiltinTypes.STRING.elemID.getFullName())
      expect(errors[0].message).toContain(BuiltinTypes.NUMBER.elemID.getFullName())
      expect(String(errors[0])).toEqual(errors[0].message)
    })
  })

  describe('merging placeholders', () => {
    it('update type pointers with the modified type', () => {
      const elements = [
        base,
        unrelated,
        fieldUpdate,
        fieldUpdate2,
        updateAnno,
        updateAnnoValues,
        instanceElement,
        instanceElement2,
      ]
      const { merged, errors } = mergeElements(elements)
      expect(errors).toHaveLength(0)
      expect(merged).toHaveLength(4)
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
      fields: [
        { name: 'field1', type: strType, annotations: { _default: 'field1' } },
        { name: 'field2', type: strType },
        { name: 'base', type: base },
      ],
    })
    const ins1 = new InstanceElement(
      'ins',
      nested,
      { field1: 'ins1', field2: 'ins1' },
      undefined,
      { anno: 1 },
    )
    const ins2 = new InstanceElement(
      'ins',
      nested,
      { base: { field1: 'ins2', field2: 'ins2' } },
      undefined,
      { anno2: 1 },
    )
    const shouldUseFieldDef = new InstanceElement('ins', nested, {
      field2: 'ins1',
    })
    it('should merge instances', () => {
      const elements = [ins1, ins2]
      const { merged, errors } = mergeElements(elements)
      expect(errors).toHaveLength(0)
      expect(merged).toHaveLength(1)
      const ins = merged[0] as InstanceElement
      expect(ins.value).toEqual({
        field1: 'ins1',
        field2: 'ins1',
        base: {
          field1: 'ins2',
          field2: 'ins2',
        },
      })
      expect(ins.annotations).toEqual({ anno: 1, anno2: 1 })
    })

    it('should fail on multiple values for same key', () => {
      const elements = [ins1, shouldUseFieldDef]
      const { errors } = mergeElements(elements)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateInstanceKeyError)
    })

    it('should fail on multiple values for same annotation', () => {
      const conflicting = ins2.clone()
      conflicting.annotations = ins1.annotations
      const { errors } = mergeElements([ins1, conflicting])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateAnnotationError)
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
      const { errors } = mergeElements(elements)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(MultiplePrimitiveTypesUnsupportedError)
    })
  })

  describe('merging variables', () => {
    it('should fail when more then one variable is defined with same elemID', () => {
      const var1 = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName'), 5)
      const var2 = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName'), 5)
      const elements = [var1, var2]
      const { errors } = mergeElements(elements)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateVariableNameError)
    })

    it('should succeed when no more then one variable is defined with same elemID', () => {
      const var1 = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName'), 5)
      const var2 = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName2'), 8)
      const elements = [var1, var2]
      const { merged, errors } = mergeElements(elements)
      expect(errors).toHaveLength(0)
      expect(merged).toHaveLength(2)
      const merged1 = merged[0] as Variable
      const merged2 = merged[1] as Variable
      expect(merged1.value).toEqual(5)
      expect(merged2.value).toEqual(8)
      expect(merged1.elemID.getFullName()).toEqual('var.varName')
      expect(merged2.elemID.getFullName()).toEqual('var.varName2')
    })
  })

  describe('replace type defs', () => {
    const typeRef = (typeToRef: TypeElement): ObjectType =>
      new ObjectType({ elemID: typeToRef.elemID })

    const strType = new PrimitiveType({
      elemID: new ElemID('salto', 'string'),
      primitive: PrimitiveTypes.STRING,
      annotations: { _default: 'type' },
    })

    const nestedElemID = new ElemID('salto', 'nested')

    const nested = new ObjectType({
      elemID: nestedElemID,
      fields: [
        { name: 'prim', type: typeRef(strType) },
        { name: 'base', type: typeRef(base) },
      ],
    })

    it('should replace type refs with full types', () => {
      const { merged, errors } = mergeElements([
        strType,
        base,
        nested,
      ])
      expect(errors).toHaveLength(0)
      const element = merged[2] as ObjectType
      expect(element.fields.prim.type).toEqual(strType)
      expect(element.fields.base.type).toEqual(base)
    })
  })
})
