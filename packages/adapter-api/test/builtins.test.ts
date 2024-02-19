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
import { Values } from '../src/values'
import { CORE_ANNOTATIONS, getRestriction, createRestriction } from '../src/builtins'

describe('builtins', () => {
  describe('getRestriction', () => {
    let result: ReturnType<typeof getRestriction>
    describe('when element has restriction', () => {
      let annotations: Values
      beforeEach(() => {
        annotations = {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ min: 10 }),
        }
        result = getRestriction({ annotations })
      })
      it('should a reference to the restriction', () => {
        expect(result).toBe(annotations[CORE_ANNOTATIONS.RESTRICTION])
      })
    })
    describe('when element has no restriction', () => {
      beforeEach(() => {
        result = getRestriction({ annotations: {} })
      })
      it('should return an empty object', () => {
        expect(result).toEqual({})
      })
    })
  })
})
