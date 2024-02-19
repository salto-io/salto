/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  ObjectType,
  ElemID,
  BuiltinTypes,
  InstanceElement,
  PrimitiveType,
  PrimitiveTypes,
  TypeElement,
  Variable,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { mergeElements, DuplicateAnnotationError, mergeSingleElement } from '../src/merger'
import {
  ConflictingFieldTypesError,
  DuplicateAnnotationFieldDefinitionError,
  DuplicateAnnotationTypeError,
} from '../src/merger/internal/object_types'
import { DuplicateInstanceKeyError } from '../src/merger/internal/instances'
import { MultiplePrimitiveTypesError } from '../src/merger/internal/primitives'
import { DuplicateVariableNameError } from '../src/merger/internal/variables'

const { awu } = collections.asynciterable

describe('merger', () => {
  const baseElemID = new ElemID('salto', 'base')
  const base = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: {
        refType: BuiltinTypes.STRING,
        annotations: { label: 'base' },
      },
      field2: {
        refType: BuiltinTypes.STRING,
        annotations: { label: 'base' },
      },
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
      field1: {
        refType: BuiltinTypes.STRING,
        annotations: { label: 'base' },
      },
    },
  })

  const fieldAnnotationConflict = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: {
        refType: BuiltinTypes.STRING,
        annotations: { label: 'update1' },
      },
    },
  })

  const fieldTypeConflict = new ObjectType({
    elemID: baseElemID,
    fields: {
      field2: { refType: BuiltinTypes.NUMBER },
    },
  })

  const fieldUpdate = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: {
        refType: BuiltinTypes.STRING,
        annotations: { a: 'update' },
      },
    },
  })

  const fieldUpdate2 = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: {
        refType: BuiltinTypes.STRING,
        annotations: { b: 'update' },
      },
    },
  })

  const newField = new ObjectType({
    elemID: baseElemID,
    fields: {
      field3: { refType: BuiltinTypes.STRING },
    },
  })

  const updateAnno = new ObjectType({
    elemID: baseElemID,
    annotationRefsOrTypes: {
      anno1: BuiltinTypes.STRING,
    },
  })

  const multipleUpdateAnno = new ObjectType({
    elemID: baseElemID,
    annotationRefsOrTypes: {
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

  const mergedObject = new ObjectType({
    elemID: baseElemID,
    fields: {
      field1: {
        refType: BuiltinTypes.STRING,
        annotations: { label: 'base', a: 'update', b: 'update' },
      },
      field2: {
        refType: BuiltinTypes.STRING,
        annotations: { label: 'base' },
      },
      field3: {
        refType: BuiltinTypes.STRING,
      },
    },
    annotations: {
      anno1: 'updated',
      _default: {
        field1: 'base1',
        field2: 'base2',
      },
    },
    annotationRefsOrTypes: {
      anno1: BuiltinTypes.STRING,
    },
  })

  const typeRef = (typeToRef: TypeElement): ObjectType => new ObjectType({ elemID: typeToRef.elemID })

  describe('updates', () => {
    it('does not modify an element list with no updates', async () => {
      const elements = [base, unrelated]
      const { merged, errors } = await mergeElements(awu(elements))
      expect(await awu(errors.values()).flat().toArray()).toHaveLength(0)
      expect(await awu(merged.values()).toArray()).toHaveLength(2)
    })

    it('merges multiple field blocks', async () => {
      const elements = [base, unrelated, fieldUpdate, fieldUpdate2, newField, updateAnno, updateAnnoValues]
      const { merged, errors } = await mergeElements(awu(elements))
      expect(await awu(errors.values()).flat().toArray()).toHaveLength(0)
      expect(await awu(merged.values()).toArray()).toHaveLength(2)
      expect((await awu(merged.values()).toArray())[0]).toEqual(mergedObject)
    })

    it('returns the same result regardless of the elements order', async () => {
      const elements = [fieldUpdate, updateAnno, newField, base, unrelated, fieldUpdate2, updateAnnoValues]
      const { merged, errors } = await mergeElements(awu(elements))
      expect(await awu(errors.values()).flat().toArray()).toHaveLength(0)
      expect(await awu(merged.values()).toArray()).toHaveLength(2)
      expect((await awu(merged.values()).toArray())[0]).toEqual(mergedObject)
    })

    it('returns an error when the same field annotation is defined multiple times', async () => {
      const elements = [base, fieldAnnotationConflict]
      const errors = await awu((await mergeElements(awu(elements))).errors.values())
        .flat()
        .toArray()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateAnnotationFieldDefinitionError)
    })

    it('returns an error when multiple updates exists for same annotation', async () => {
      const elements = [base, updateAnno, multipleUpdateAnno]
      const errors = await awu((await mergeElements(awu(elements))).errors.values())
        .flat()
        .toArray()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateAnnotationTypeError)
    })

    it('returns an error when multiple updates exists for same annotation value', async () => {
      const elements = [base, updateAnnoValues, multipleUpdateAnnoValues]
      const errors = await awu((await mergeElements(awu(elements))).errors.values())
        .flat()
        .toArray()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateAnnotationError)
    })

    it('returns an error when field definitions have conflicting types', async () => {
      const elements = [base, fieldTypeConflict]
      const errors = await awu((await mergeElements(awu(elements))).errors.values())
        .flat()
        .toArray()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(ConflictingFieldTypesError)
      expect(errors[0].message).toContain(BuiltinTypes.STRING.elemID.getFullName())
      expect(errors[0].message).toContain(BuiltinTypes.NUMBER.elemID.getFullName())
      expect(String(errors[0])).toEqual(errors[0].message)
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
        field1: {
          refType: strType,
          annotations: { _default: 'field1' },
        },
        field2: {
          refType: strType,
        },
        base: {
          refType: base,
        },
      },
    })
    const ins1 = new InstanceElement('ins', nested, { field1: 'ins1', field2: 'ins1' }, undefined, { anno: 1 })
    const ins2 = new InstanceElement('ins', nested, { base: { field1: 'ins2', field2: 'ins2' } }, undefined, {
      anno2: 1,
    })
    const shouldUseFieldDef = new InstanceElement('ins', nested, {
      field2: 'ins1',
    })
    it('should merge instances', async () => {
      const elements = [ins1, ins2]
      const { merged, errors } = await mergeElements(awu(elements))
      expect(await awu(errors.values()).flat().toArray()).toHaveLength(0)
      expect(await awu(merged.values()).toArray()).toHaveLength(1)
      const ins = (await awu(merged.values()).toArray())[0] as InstanceElement
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

    it('should fail on multiple values for same key', async () => {
      const elements = [ins1, shouldUseFieldDef]
      const errors = await awu((await mergeElements(awu(elements))).errors.values())
        .flat()
        .toArray()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateInstanceKeyError)
    })

    it('should fail on multiple values for same annotation', async () => {
      const conflicting = ins2.clone()
      conflicting.annotations = ins1.annotations
      const errors = await awu((await mergeElements(awu([ins1, conflicting]))).errors.values())
        .flat()
        .toArray()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateAnnotationError)
    })
  })

  describe('merging primitives', () => {
    const strType = new PrimitiveType({
      elemID: new ElemID('salto', 'string'),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        somethingElse: BuiltinTypes.STRING,
      },
      annotations: { somethingElse: 'type' },
    })

    const duplicateType = new PrimitiveType({
      elemID: new ElemID('salto', 'string'),
      primitive: PrimitiveTypes.NUMBER,
      annotations: { _default: 'type' },
    })

    it('should fail when more then one primitive is defined with same elemID and different primitives', async () => {
      const elements = [strType, duplicateType]
      const errors = await awu((await mergeElements(awu(elements))).errors.values())
        .flat()
        .toArray()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(MultiplePrimitiveTypesError)
    })

    it('should fail when annotation types and annoations are defined in multiple fragments', async () => {
      const elements = [strType, strType]
      const errors = await awu((await mergeElements(awu(elements))).errors.values())
        .flat()
        .toArray()
      expect(errors).toHaveLength(2)
      expect(errors[0]).toBeInstanceOf(DuplicateAnnotationTypeError)
      expect(errors[1]).toBeInstanceOf(DuplicateAnnotationTypeError)
    })
  })

  describe('merging variables', () => {
    it('should fail when more then one variable is defined with same elemID', async () => {
      const var1 = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName'), 5)
      const var2 = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName'), 5)
      const elements = [var1, var2]
      const errors = await awu((await mergeElements(awu(elements))).errors.values())
        .flat()
        .toArray()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(DuplicateVariableNameError)
    })

    it('should succeed when no more then one variable is defined with same elemID', async () => {
      const var1 = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName'), 5)
      const var2 = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName2'), 8)
      const elements = [var1, var2]
      const { merged, errors } = await mergeElements(awu(elements))
      expect(await awu(errors.values()).flat().toArray()).toHaveLength(0)
      expect(await awu(merged.values()).toArray()).toHaveLength(2)
      const merged1 = (await awu(merged.values()).toArray())[0] as Variable
      const merged2 = (await awu(merged.values()).toArray())[1] as Variable
      expect(merged1.value).toEqual(5)
      expect(merged2.value).toEqual(8)
      expect(merged1.elemID.getFullName()).toEqual('var.varName')
      expect(merged2.elemID.getFullName()).toEqual('var.varName2')
    })
  })

  describe('merging settings', () => {
    const settingElemID = new ElemID('salto', 'settingObj')
    const setting1 = new ObjectType({
      isSettings: true,
      elemID: settingElemID,
      fields: {
        setting1: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    const setting2 = new ObjectType({
      isSettings: true,
      elemID: settingElemID,
      fields: {
        setting2: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    const mergedSetting = new ObjectType({
      isSettings: true,
      elemID: settingElemID,
      fields: {
        setting1: {
          refType: BuiltinTypes.STRING,
        },
        setting2: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    const badSettingType = new ObjectType({
      isSettings: false,
      elemID: settingElemID,
    })

    it('should merge settings types', async () => {
      const elements = [setting1, setting2]
      const { merged, errors } = await mergeElements(awu(elements))
      expect(await awu(errors.values()).flat().isEmpty()).toBeTruthy()
      expect(await awu(merged.values()).toArray()).toHaveLength(1)
      expect((await awu(merged.values()).toArray())[0]).toEqual(mergedSetting)
    })
    it('should raise an error for isSettingType mismatch', async () => {
      const elements = [setting1, badSettingType]
      const errors = await awu((await mergeElements(awu(elements))).errors.values())
        .flat()
        .toArray()
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
    it('should replace type refs with full types in the elements that are being merged', async () => {
      const elements = [instanceElementToMerge]
      const { errors, merged } = await mergeElements(awu(elements))
      expect(await awu(errors.values()).flat().toArray()).toHaveLength(0)
      const mergedElement = await awu(merged.values())
        .filter(e => e.elemID.isEqual(instanceElementToMerge.elemID))
        .toArray()
      expect(mergedElement).toBeDefined()
      // expect((mergedElement as InstanceElement).type).toBe(objectType)
    })
    it('should not replace type refs with full types in the context elements', async () => {
      const elements = [instanceElementToMerge]
      const { errors, merged } = await mergeElements(awu(elements))
      expect(await awu(errors.values()).flat().toArray()).toHaveLength(0)
      const mergedElement = await awu(merged.values()).find(e => e.elemID.isEqual(instanceElementContext.elemID))
      expect(mergedElement).toBeUndefined()
      expect(instanceElementContext.refType).not.toBe(objectType.elemID)
    })
  })

  describe('merge single element', () => {
    const type = new ObjectType({ elemID: new ElemID('adapter', 'type') })
    it('should throw an error if there is a merge error', async () => {
      const instance1 = new InstanceElement('instance', type, { value: 1 })
      const instance2 = new InstanceElement('instance', type, { value: 2 })
      await expect(mergeSingleElement([instance1, instance2])).rejects.toThrow('Received merge errors')
    })

    it('should throw an error if received more than one merged elements', async () => {
      const instance1 = new InstanceElement('instance', type, { value: 1 })
      const instance2 = new InstanceElement('instance2', type, { value: 2 })
      await expect(mergeSingleElement([instance1, instance2])).rejects.toThrow(
        'Received invalid number of merged elements when expected one',
      )
    })

    it('should return the merged element when valid', async () => {
      const instance1 = new InstanceElement('instance', type, { value1: 1 })
      const instance2 = new InstanceElement('instance', type, { value2: 2 })
      const merged = await mergeSingleElement([instance1, instance2])
      expect(merged.value).toEqual({ value1: 1, value2: 2 })
    })
  })
})
