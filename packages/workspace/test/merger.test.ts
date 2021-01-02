/*
*                      Copyright 2021 Salto Labs Ltd.
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
  PrimitiveTypes, TypeElement, Variable, MapType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { mergeElements, DuplicateAnnotationError } from '../src/merger'
import { ConflictingFieldTypesError, DuplicateAnnotationFieldDefinitionError,
  DuplicateAnnotationTypeError } from '../src/merger/internal/object_types'
import { DuplicateInstanceKeyError } from '../src/merger/internal/instances'
import { MultiplePrimitiveTypesUnsupportedError } from '../src/merger/internal/primitives'
import { DuplicateVariableNameError } from '../src/merger/internal/variables'

describe('merger', () => {
  const baseElemID = new ElemID('salto', 'base')
  const base = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: { type: BuiltinTypes.STRING, annotations: { label: 'base' } },
      field2: { type: BuiltinTypes.STRING, annotations: { label: 'base' } },
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
      field1: { type: BuiltinTypes.STRING, annotations: { label: 'base' } },
    },
  })

  const fieldAnnotationConflict = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: { type: BuiltinTypes.STRING, annotations: { label: 'update1' } },
    },
  })

  const fieldTypeConflict = new ObjectType({
    elemID: baseElemID,
    fields: {
      field2: { type: BuiltinTypes.NUMBER },
    },
  })

  const fieldUpdate = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: { type: BuiltinTypes.STRING, annotations: { a: 'update' } },
    },
  })

  const fieldUpdate2 = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: { type: BuiltinTypes.STRING, annotations: { b: 'update' } },
    },
  })

  const newField = new ObjectType({
    elemID: baseElemID,
    fields: {
      field3: { type: BuiltinTypes.STRING },
    },
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
    fields: {
      field1: { type: BuiltinTypes.STRING, annotations: { label: 'base', a: 'update', b: 'update' } },
      field2: { type: BuiltinTypes.STRING, annotations: { label: 'base' } },
      field3: { type: BuiltinTypes.STRING },
    },
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

  const typeRef = (typeToRef: TypeElement): ObjectType =>
    new ObjectType({ elemID: typeToRef.elemID })

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

    it('update placehoder for map types', () => {
      const primElemID = new ElemID('salto', 'string')
      const prim = new PrimitiveType({
        elemID: primElemID,
        primitive: PrimitiveTypes.STRING,
      })
      const objType = new ObjectType({
        elemID: new ElemID('salto', 'obj'),
        fields: {
          prim: {
            type: new MapType(new ObjectType({
              elemID: primElemID,
            })),
          },
        },
      })

      const { merged, errors } = mergeElements([prim, objType])
      expect(errors).toHaveLength(0)
      expect(merged).toHaveLength(2)
      const mergedPrim = merged[0] as PrimitiveType
      const mergedObj = merged[1] as ObjectType
      const mapType = mergedObj.fields.prim.type as MapType
      expect(mapType.innerType).toEqual(mergedPrim)
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
        field1: { type: strType, annotations: { _default: 'field1' } },
        field2: { type: strType },
        base: { type: base },
      },
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
    const strType = new PrimitiveType({
      elemID: new ElemID('salto', 'string'),
      primitive: PrimitiveTypes.STRING,
      annotations: { _default: 'type' },
    })

    const nestedElemID = new ElemID('salto', 'nested')

    const nested = new ObjectType({
      elemID: nestedElemID,
      fields: {
        prim: { type: typeRef(strType) },
        base: { type: typeRef(base) },
      },
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

  describe('merging settings', () => {
    const settingElemID = new ElemID('salto', 'settingObj')
    const setting1 = new ObjectType({
      isSettings: true,
      elemID: settingElemID,
      fields: {
        setting1: { type: BuiltinTypes.STRING },
      },
    })
    const setting2 = new ObjectType({
      isSettings: true,
      elemID: settingElemID,
      fields: {
        setting2: { type: BuiltinTypes.STRING },
      },
    })
    const mergedSetting = new ObjectType({
      isSettings: true,
      elemID: settingElemID,
      fields: {
        setting1: { type: BuiltinTypes.STRING },
        setting2: { type: BuiltinTypes.STRING },
      },
    })
    const badSettingType = new ObjectType({
      isSettings: false,
      elemID: settingElemID,
    })

    it('should merge settings types', () => {
      const elements = [setting1, setting2]
      const { merged, errors } = mergeElements(elements)
      expect(_.isEmpty(errors)).toBeTruthy()
      expect(merged).toHaveLength(1)
      expect(merged[0]).toEqual(mergedSetting)
    })
    it('should raise an error for isSettingType mismatch', () => {
      const elements = [setting1, badSettingType]
      const { errors } = mergeElements(elements)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Error merging salto.settingObj: conflicting is settings definitions')
    })
  })

  describe('merge with context', () => {
    const objectTypeElemID = new ElemID('salesforce', 'test')
    const objTypeAnnotation = { test: 'my test' }
    const objectType = new ObjectType({ elemID: objectTypeElemID, annotations: objTypeAnnotation })
    const instanceElementToMerge = new InstanceElement('inst', typeRef(objectType))
    const instanceElementContext = new InstanceElement('instInContext', typeRef(objectType))
    it('should replace type refs with full types in the elements that are being merged', () => {
      const elements = [instanceElementToMerge]
      const context = _.keyBy([objectType], e => e.elemID.getFullName())
      const { errors, merged } = mergeElements(elements, context)
      expect(errors).toHaveLength(0)
      const mergedElement = merged.find(e => e.elemID.isEqual(instanceElementToMerge.elemID))
      expect(mergedElement).toBeDefined()
      expect((mergedElement as InstanceElement).type).toBe(objectType)
    })
    it('should not replace type refs with full types in the context elements', () => {
      const elements = [instanceElementToMerge]
      const context = _.keyBy([objectType, instanceElementContext], e => e.elemID.getFullName())
      const { errors, merged } = mergeElements(elements, context)
      expect(errors).toHaveLength(0)
      const mergedElement = merged.find(e => e.elemID.isEqual(instanceElementContext.elemID))
      expect(mergedElement).toBeUndefined()
      expect(instanceElementContext.type).not.toBe(objectType)
    })
  })
})
