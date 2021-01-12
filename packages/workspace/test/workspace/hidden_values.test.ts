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
import { ObjectType, ElemID, BuiltinTypes, PrimitiveType, PrimitiveTypes, isObjectType, InstanceElement, isInstanceElement, CORE_ANNOTATIONS, DetailedChange, getChangeElement } from '@salto-io/adapter-api'
import { State } from '../../src/workspace/state'
import { MergeResult } from '../../src/merger'
import { handleHiddenChanges, mergeWithHidden } from '../../src/workspace/hidden_values'

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
    const instance = new InstanceElement(
      'instance',
      new ObjectType({
        elemID: new ElemID('test', 'type'),
      }),
      {},
      undefined,
      { [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl' }
    )

    const change: DetailedChange = {
      id: instance.elemID,
      action: 'add',
      data: { after: instance },
    }

    it('hidden_string value should be omitted', async () => {
      const result = await handleHiddenChanges(
        [change],
        jest.fn() as unknown as State,
        jest.fn().mockResolvedValue([])
      )

      expect(result.length).toBe(1)
      expect(getChangeElement(result[0])).toBeDefined()
      expect(getChangeElement(result[0])?.annotations?.[CORE_ANNOTATIONS.SERVICE_URL])
        .toBeUndefined()
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
        {
          get: (id: ElemID) => Promise.resolve(id.isEqual(object.elemID)
            ? object
            : undefined),
        } as unknown as State,
        jest.fn().mockResolvedValue([])
      )

      expect(result.length).toBe(0)
    })
  })
})
