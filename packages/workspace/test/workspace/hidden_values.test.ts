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
import { ObjectType, ElemID, BuiltinTypes, PrimitiveType, PrimitiveTypes } from '@salto-io/adapter-api'
import { mergeWithHidden } from '../../src/workspace/hidden_values'
import { MergeResult } from '../../src/merger'

describe('mergeWithHidden', () => {
  describe('when parent value is deleted in the workspace', () => {
    let result: MergeResult
    beforeEach(() => {
      const fieldType = new PrimitiveType({
        elemID: new ElemID('test', 'prim'),
        primitive: PrimitiveTypes.STRING,
        annotationTypes: { hiddenAnno: BuiltinTypes.HIDDEN_STRING },
      })
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
      const mergedWorkspaceObj = result.merged[1] as ObjectType
      expect(mergedWorkspaceObj.fields).not.toHaveProperty('f1')
    })
  })
})
