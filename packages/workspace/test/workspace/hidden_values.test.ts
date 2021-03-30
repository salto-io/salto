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
import { MergeResult } from '../../src/merger'
import { handleHiddenChanges, mergeWithHidden } from '../../src/workspace/hidden_values'
import { mockState } from '../common/state'
import { mockFunction } from '../common/helpers'

describe('mergeWithHidden', () => {
  const getFieldType = (typeName: string, primitive: PrimitiveTypes): PrimitiveType => (
    new PrimitiveType({
      elemID: new ElemID('test', typeName),
      primitive,
      annotationTypes: { hiddenAnno: BuiltinTypes.HIDDEN_STRING },
    })
  )
  describe('when parent value is deleted in the workspace', () => {
    let result: MergeResult
    beforeEach(() => {
      const fieldType = getFieldType('text', PrimitiveTypes.STRING)
      const mockObjType = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          f1: { type: fieldType, annotations: { hiddenAnno: 'asd' } },
        },
      })
      const workspaceObjType = mockObjType.clone()
      delete workspaceObjType.fields.f1
      result = mergeWithHidden([fieldType, workspaceObjType], [fieldType, mockObjType])
    })
    it('should omit the hidden value', () => {
      const mergedWorkspaceObj = result.merged.find(isObjectType)
      expect(mergedWorkspaceObj?.fields).not.toHaveProperty('f1')
    })
  })
  describe('when field type is changed in the workspace', () => {
    let result: MergeResult
    beforeEach(() => {
      const workspaceFieldType = getFieldType('num', PrimitiveTypes.NUMBER)
      const workspaceType = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          test: { type: workspaceFieldType },
        },
      })
      const stateFieldType = getFieldType('text', PrimitiveTypes.STRING)
      const stateType = new ObjectType({
        ...workspaceType,
        fields: {
          test: { type: stateFieldType, annotations: { hiddenAnno: 'asd' } },
        },
      })
      result = mergeWithHidden([workspaceFieldType, workspaceType], [stateFieldType, stateType])
    })
    it('should not have merge errors', () => {
      expect(result.errors).toHaveLength(0)
    })
    it('should still add hidden annotations to the field', () => {
      const type = result.merged.find(isObjectType)
      expect(type?.fields.test.annotations).toHaveProperty('hiddenAnno', 'asd')
    })
  })

  describe('hidden_string in instance annotation', () => {
    let result: MergeResult
    beforeEach(() => {
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


      result = mergeWithHidden([workspaceInstance], [stateInstance])
    })
    it('should not have merge errors', () => {
      expect(result.errors).toHaveLength(0)
    })
    it('should have the hidden_string value', () => {
      const instance = result.merged.find(isInstanceElement)
      expect(instance?.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toBe('someUrl')
    })
  })

  describe('hidden annotation in field', () => {
    let result: MergeResult
    beforeEach(() => {
      const workspaceObject = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          field: {
            type: BuiltinTypes.STRING,
          },
        },
      })

      const stateObject = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          field: {
            type: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl' },
          },
        },
      })


      result = mergeWithHidden([workspaceObject], [stateObject])
    })
    it('should not have merge errors', () => {
      expect(result.errors).toHaveLength(0)
    })
    it('should have the hidden annotation value', () => {
      const object = result.merged.find(isObjectType)
      expect(object?.fields?.field?.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toBe('someUrl')
    })
  })
})

describe('handleHiddenChanges', () => {
  describe('hidden_string in instance annotations', () => {
    let instance: InstanceElement
    beforeEach(() => {
      instance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID('test', 'type'),
          fields: {
            val: { type: BuiltinTypes.STRING },
          },
        }),
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

        result = await handleHiddenChanges(
          [change],
          mockState(),
          mockFunction<() => Promise<Element[]>>().mockResolvedValue([])
        )
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

        result = await handleHiddenChanges(
          [change],
          mockState([instance.type, instance]),
          mockFunction<() => Promise<Element[]>>().mockResolvedValue([])
        )
      })
      it('should omit the whole change', () => {
        expect(result).toHaveLength(0)
      })
    })
  })

  describe('hidden annotation of field', () => {
    const object = new ObjectType({
      elemID: new ElemID('test', 'type'),
      fields: {
        field: {
          type: BuiltinTypes.STRING,
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
      const result = await handleHiddenChanges(
        [change],
        mockState([object]),
        mockFunction<() => Promise<Element[]>>().mockResolvedValue([])
      )

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
            val: { type: refTargetType },
            ref: { type: refTargetType },
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

        result = await handleHiddenChanges(
          [change],
          mockState([instance]),
          mockFunction<() => Promise<Element[]>>().mockResolvedValue([])
        )
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

        result = await handleHiddenChanges(
          [change],
          mockState([instance]),
          mockFunction<() => Promise<Element[]>>().mockResolvedValue([])
        )
        expect(result).toHaveLength(1)
        filteredValue = getChangeElement(result[0])
      })
      it('should keep the updated value as a reference expression', () => {
        expect(filteredValue).toBeInstanceOf(ReferenceExpression)
      })
    })
  })
})
