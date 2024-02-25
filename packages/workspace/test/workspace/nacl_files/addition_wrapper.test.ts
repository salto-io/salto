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
import { ObjectType, ElemID, BuiltinTypes } from '@salto-io/adapter-api'
import { wrapNestedValues } from '../../../src/workspace/nacl_files/addition_wrapper'

describe('addition wrapper', () => {
  describe('wrapNestedValues', () => {
    let obj: ObjectType

    beforeEach(() => {
      obj = new ObjectType({
        elemID: new ElemID('salto', 'obj'),
        fields: {
          abc: { refType: BuiltinTypes.STRING },
        },
      })
    })

    it('should return the expected value when adding to an existing field', () => {
      const newObj = wrapNestedValues(
        [{ id: new ElemID('salto', 'obj', 'field', 'abc', 'anno1'), value: 'def' }],
        obj,
      ) as ObjectType
      expect(newObj).toBeInstanceOf(ObjectType)
      expect(newObj.fields.abc.annotations).toEqual({ anno1: 'def' })
    })

    it('should throw an error when attempting to add to a nonexistent field', () => {
      expect(() =>
        wrapNestedValues([{ id: new ElemID('salto', 'obj', 'field', 'invalid', 'anno1'), value: 'def' }], obj),
      ).toThrow(new Error('field invalid was not found in common object type salto.obj'))
    })
  })
})
