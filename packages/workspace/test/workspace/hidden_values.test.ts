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
import { ObjectType, ElemID, BuiltinTypes, PrimitiveType, PrimitiveTypes, isObjectType, InstanceElement, isInstanceElement, DetailedChange, getChangeElement } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { State } from '../../src/workspace/state'
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

  describe('hidden_string field', () => {
    let result: MergeResult
    beforeEach(async () => {
      const workspaceInstance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID('test', 'type'),
          fields: {
            test: { refType: createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING) },
          },
        }),
      )

      const stateInstance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID('test', 'type'),
          fields: {
            test: { refType: createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING) },
          },
        }),
        { test: 'test' }
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
      const instance = await awu(result.merged.values()).find(isInstanceElement) as InstanceElement
      expect(instance?.value?.test).toBe('test')
    })
  })
})

describe('handleHiddenChanges', () => {
  describe('hidden_string field', () => {
    const obj = new ObjectType({
      elemID: new ElemID('test', 'type'),
      fields: {
        test: { refType: createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING) },
      },
    })
    const instance = new InstanceElement(
      'instance',
      obj,
      { test: 'test' }
    )

    const change: DetailedChange = {
      id: instance.elemID,
      action: 'add',
      data: { after: instance },
    }

    it('hidden_string value should be ommited', async () => {
      const result = await handleHiddenChanges(
        [change],
        createInMemoryElementSource([instance, obj]) as unknown as State,
        jest.fn().mockResolvedValue([]),
      )

      expect(result.length).toBe(1)
      expect(getChangeElement(result[0])?.value).toBeDefined()
      expect(getChangeElement(result[0])?.value.test).toBeUndefined()
    })
  })
})
