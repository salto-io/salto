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
import { ObjectType, ElemID, BuiltinTypes, PrimitiveType, PrimitiveTypes, isObjectType, InstanceElement, isInstanceElement, CORE_ANNOTATIONS, DetailedChange, getChangeElement, Element, INSTANCE_ANNOTATIONS, ReferenceExpression } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { mockState } from '../common/state'
import { mockFunction } from '../common/helpers'
import { MergeResult } from '../../src/merger'
import { mergeWithHidden, handleHiddenChanges } from '../../src/workspace/hidden_values'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'

const { awu } = collections.asynciterable

describe('mergeWithHidden', () => {
  const getFieldType = (typeName: string, primitive: PrimitiveTypes): PrimitiveType => (
    new PrimitiveType({
      elemID: new ElemID('test', typeName),
      primitive,
      annotationRefsOrTypes: { hiddenAnno: BuiltinTypes.HIDDEN_STRING },
    })
  )
  describe('when parent value is deleted in the workspace', () => {
    let result: MergeResult
    beforeEach(async () => {
      const fieldType = getFieldType('text', PrimitiveTypes.STRING)
      const mockObjType = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          f1: {
            refType: createRefToElmWithValue(fieldType),
            annotations: { hiddenAnno: 'asd' },
          },
        },
      })
      const workspaceObjType = mockObjType.clone()
      delete workspaceObjType.fields.f1
      result = await mergeWithHidden(
        awu([fieldType, workspaceObjType]),
        createInMemoryElementSource([fieldType, mockObjType])
      )
    })
    it('should omit the hidden value', async () => {
      const mergedWorkspaceObj = (await awu(result.merged.values())
        .find(isObjectType)) as ObjectType
      expect(mergedWorkspaceObj?.fields).not.toHaveProperty('f1')
    })
  })
  describe('when field type is changed in the workspace', () => {
    let result: MergeResult
    beforeEach(async () => {
      const workspaceFieldType = getFieldType('num', PrimitiveTypes.NUMBER)
      const workspaceType = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          test: { refType: createRefToElmWithValue(workspaceFieldType) },
        },
      })
      const stateFieldType = getFieldType('text', PrimitiveTypes.STRING)
      const stateType = new ObjectType({
        ...workspaceType,
        fields: {
          test: {
            refType: createRefToElmWithValue(stateFieldType),
            annotations: { hiddenAnno: 'asd' },
          },
        },
      })
      result = await mergeWithHidden(
        awu([workspaceFieldType, workspaceType]),
        createInMemoryElementSource([stateFieldType, stateType])
      )
    })
    it('should not have merge errors', async () => {
      expect(await awu(result.errors.values()).flat().toArray()).toHaveLength(0)
    })
    it('should still add hidden annotations to the field', async () => {
      const type = (await awu(result.merged.values()).find(isObjectType)) as ObjectType
      expect(type?.fields.test.annotations).toHaveProperty('hiddenAnno', 'asd')
    })
  })

  describe('hidden_string in instance annotation', () => {
    let result: MergeResult
    beforeEach(async () => {
      const workspaceInstance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID('test', 'type'),
        }),
      )

      const stateInstance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID('test', 'type'),
        }),
        {},
        undefined,
        { [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl' }
      )


      result = await mergeWithHidden(
        awu([workspaceInstance]),
        createInMemoryElementSource([stateInstance])
      )
    })
    it('should not have merge errors', async () => {
      expect(await awu(result.errors.values()).flat().toArray()).toHaveLength(0)
    })
    it('should have the hidden_string value', async () => {
      const instance = await awu(result.merged.values()).find(isInstanceElement)
      expect(instance?.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toBe('someUrl')
    })
  })

  describe('hidden annotation in field', () => {
    let result: MergeResult
    beforeEach(async () => {
      const workspaceObject = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          field: {
            refType: createRefToElmWithValue(BuiltinTypes.STRING),
          },
        },
      })

      const stateObject = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          field: {
            refType: createRefToElmWithValue(BuiltinTypes.STRING),
            annotations: { [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl' },
          },
        },
      })


      result = await mergeWithHidden(
        awu([workspaceObject]),
        createInMemoryElementSource([stateObject])
      )
    })
    it('should not have merge errors', async () => {
      expect(await awu(result.errors.values()).flat().isEmpty()).toBeTruthy()
    })
    it('should have the hidden annotation value', async () => {
      const object = await awu(result.merged.values()).find(isObjectType) as ObjectType
      expect(object?.fields?.field?.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toBe('someUrl')
    })
  })
})

describe('handleHiddenChanges', () => {
  describe('hidden_string in instance annotations', () => {
    let instance: InstanceElement
    let instanceType: ObjectType
    beforeEach(() => {
      instanceType = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          val: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        },
      })
      instance = new InstanceElement(
        'instance',
        instanceType,
        { val: 'asd' },
        undefined,
        { [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl' }
      )
    })

    describe('when adding the whole instance', () => {
      let result: DetailedChange[]
      let filteredInstance: InstanceElement
      beforeEach(async () => {
        const change: DetailedChange = {
          id: instance.elemID,
          action: 'add',
          data: { after: instance },
        }

        result = (await handleHiddenChanges(
          [change],
          mockState(),
          mockFunction<() => Promise<AsyncIterable<Element>>>().mockResolvedValue(awu([])),
        )).visible
        expect(result).toHaveLength(1)
        filteredInstance = getChangeElement(result[0])
      })
      it('should omit the hidden annotation', () => {
        expect(filteredInstance.annotations).not.toHaveProperty(INSTANCE_ANNOTATIONS.SERVICE_URL)
      })
      it('should keep non hidden values', () => {
        expect(filteredInstance.value).toHaveProperty('val', 'asd')
      })
    })

    describe('when adding only the hidden annotation', () => {
      let result: DetailedChange[]
      beforeEach(async () => {
        const change: DetailedChange = {
          id: instance.elemID.createNestedID(INSTANCE_ANNOTATIONS.SERVICE_URL),
          action: 'add',
          data: { after: instance.annotations[INSTANCE_ANNOTATIONS.SERVICE_URL] },
        }

        result = (await handleHiddenChanges(
          [change],
          mockState([instanceType, instance]),
          mockFunction<() => Promise<AsyncIterable<Element>>>().mockResolvedValue(awu([])),
        )).visible
      })
      it('should omit the whole change', () => {
        expect(result).toHaveLength(0)
      })
    })

    describe('when converting a remove change', () => {
      const obj = new ObjectType({
        elemID: new ElemID('salto', 'obj'),
      })
      const inst = new InstanceElement('hidden', obj, {}, [], {
        [INSTANCE_ANNOTATIONS.HIDDEN]: true,
      })
      const change: DetailedChange = {
        id: inst.elemID,
        action: 'remove',
        data: {
          before: inst,
        },
      }
      it('should return the entire change and both hidden and visible', async () => {
        const res = (await handleHiddenChanges(
          [change],
          mockState([instanceType, instance]),
          mockFunction<() => Promise<AsyncIterable<Element>>>().mockResolvedValue(awu([])),
        ))
        expect(res.visible).toHaveLength(1)
        expect(res.hidden).toHaveLength(1)
        expect(res.hidden[0].id).toEqual(change.id)
        expect(res.visible[0].id).toEqual(change.id)
      })
    })
  })

  describe('hidden annotation of field', () => {
    const object = new ObjectType({
      elemID: new ElemID('test', 'type'),
      fields: {
        field: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: { [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl' },
        },
      },
    })

    const change: DetailedChange = {
      id: object.fields.field.elemID.createNestedID(CORE_ANNOTATIONS.SERVICE_URL),
      action: 'add',
      data: { after: 'someUrl' },
    }

    it('hidden annotation should be omitted', async () => {
      const result = (await handleHiddenChanges(
        [change],
        mockState([object]),
        mockFunction<() => Promise<AsyncIterable<Element>>>().mockResolvedValue(awu([])),
      )).visible
      expect(result.length).toBe(0)
    })
  })

  describe('reference expression', () => {
    let instance: InstanceElement
    beforeEach(() => {
      const refTargetType = new ObjectType({ elemID: new ElemID('test', 'refTarget') })
      instance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID('test', 'type'),
          fields: {
            val: { refType: createRefToElmWithValue(refTargetType) },
            ref: { refType: createRefToElmWithValue(refTargetType) },
          },
        }),
        { val: 'asd' },
      )
    })

    describe('when adding a reference expression', () => {
      let result: DetailedChange[]
      let filteredValue: unknown
      beforeEach(async () => {
        const change: DetailedChange = {
          id: instance.elemID.createNestedID('ref'),
          action: 'add',
          data: {
            after: new ReferenceExpression(new ElemID('a', 'b')),
          },
        }

        result = (await handleHiddenChanges(
          [change],
          mockState([instance]),
          mockFunction<() => Promise<AsyncIterable<Element>>>().mockResolvedValue(awu([])),
        )).visible
        expect(result).toHaveLength(1)
        filteredValue = getChangeElement(result[0])
      })
      it('should keep the reference expression as-is', () => {
        expect(filteredValue).toBeInstanceOf(ReferenceExpression)
      })
    })
    describe('when converting a value to a reference expression', () => {
      let result: DetailedChange[]
      let filteredValue: unknown
      beforeEach(async () => {
        const change: DetailedChange = {
          id: instance.elemID.createNestedID('val'),
          action: 'modify',
          data: {
            before: 'asd',
            after: new ReferenceExpression(new ElemID('a', 'b')),
          },
        }

        result = (await handleHiddenChanges(
          [change],
          mockState([instance]),
          mockFunction<() => Promise<AsyncIterable<Element>>>().mockResolvedValue(awu([])),
        )).visible
        expect(result).toHaveLength(1)
        filteredValue = getChangeElement(result[0])
      })
      it('should keep the updated value as a reference expression', () => {
        expect(filteredValue).toBeInstanceOf(ReferenceExpression)
      })
    })
  })
})
