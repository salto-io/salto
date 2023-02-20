/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType } from '@salto-io/adapter-api'
import { types } from '@salto-io/lowerdash'
import { isHidden, isHiddenValue, isRequired, isUpdatable } from '../src/core'

describe('core utils', () => {
  const MOCK_TYPE = new ObjectType({ elemID: new ElemID('adapter', 'TestType') })
  describe('annotations', () => {
    type TestInput = {
      method: types.Predicate<Element>
      annotation: string
      valueWhenUndefined: boolean
    }
    const withName = (testInput: TestInput): TestInput & {name: string} => (
      {
        ...testInput,
        name: testInput.method.name,
      }
    )
    describe.each([
      { method: isHidden, annotation: CORE_ANNOTATIONS.HIDDEN, valueWhenUndefined: false },
      { method: isHiddenValue, annotation: CORE_ANNOTATIONS.HIDDEN_VALUE, valueWhenUndefined: false },
      { method: isRequired, annotation: CORE_ANNOTATIONS.REQUIRED, valueWhenUndefined: false },
      { method: isUpdatable, annotation: CORE_ANNOTATIONS.UPDATABLE, valueWhenUndefined: true },
    ].map(withName))('$name', ({ method, annotation, valueWhenUndefined }) => {
      let field: Field
      beforeEach(() => {
        field = new Field(MOCK_TYPE, 'testField', BuiltinTypes.STRING)
      })
      describe.each([
        { annotationValue: true, expected: true },
        { annotationValue: false, expected: false },
        { annotationValue: undefined, expected: valueWhenUndefined },
      ])('when annotation value is $annotationValue', ({ annotationValue, expected }) => {
        beforeEach(() => {
          field.annotations[annotation] = annotationValue
        })
        it(`should return ${expected}`, () => {
          expect(method(field)).toEqual(expected)
        })
      })
    })
  })
})
