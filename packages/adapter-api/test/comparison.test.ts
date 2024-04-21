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

import { ElemID } from '../src/element_id'
import { ReferenceExpression, StaticFile } from '../src/values'
import { areReferencesEqual, compareSpecialValues, isEqualValues, shouldResolve } from '../src/comparison'

describe('comparisons', () => {
  describe('shouldResolve', () => {
    it('should return true for non reference expressions', () => {
      const result = shouldResolve({})
      expect(result).toEqual(true)
    })

    it('should return true for non base elements', () => {
      const result = shouldResolve(
        new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'someInstance', 'nested')),
      )
      expect(result).toEqual(true)
    })

    it('should return true for vars', () => {
      const result = shouldResolve(new ReferenceExpression(new ElemID('adapter', 'someType', 'var')))
      expect(result).toEqual(true)
    })

    it('should return false for top level elements', () => {
      const result = shouldResolve(new ReferenceExpression(new ElemID('adapter', 'someType')))
      expect(result).toEqual(false)
    })
  })

  describe('areReferencesEqual', () => {
    const firstValue = 'first value'
    const secondValue = 'second value'

    let firstVisitedReferences: Set<string>
    let secondVisitedReferences: Set<string>

    beforeEach(() => {
      firstVisitedReferences = new Set<string>()
      secondVisitedReferences = new Set<string>()
    })

    describe('compare by value', () => {
      const compareOptions = {
        compareByValue: true,
      }

      it('should recurse when both are resolved references', () => {
        const result = areReferencesEqual({
          first: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'parent', 'first'), firstValue),
          second: new ReferenceExpression(
            new ElemID('adapter', 'someType', 'instance', 'parent', 'second'),
            secondValue,
          ),
          firstVisitedReferences,
          secondVisitedReferences,
          compareOptions,
        })
        expect(result).toEqual({
          returnCode: 'recurse',
          returnValue: {
            firstValue,
            secondValue,
          },
        })
      })

      it('should recurse when first is a resolved reference and second is a value', () => {
        const result = areReferencesEqual({
          first: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'parent', 'first'), firstValue),
          second: secondValue,
          firstVisitedReferences,
          secondVisitedReferences,
          compareOptions,
        })
        expect(result).toEqual({
          returnCode: 'recurse',
          returnValue: {
            firstValue,
            secondValue,
          },
        })
      })

      it('should recurse when first is a value and second is a resolved reference', () => {
        const result = areReferencesEqual({
          first: firstValue,
          second: new ReferenceExpression(
            new ElemID('adapter', 'someType', 'instance', 'parent', 'second'),
            secondValue,
          ),
          firstVisitedReferences,
          secondVisitedReferences,
          compareOptions,
        })
        expect(result).toEqual({
          returnCode: 'recurse',
          returnValue: {
            firstValue,
            secondValue,
          },
        })
      })

      it('should return false when both are values', () => {
        const result = areReferencesEqual({
          first: firstValue,
          second: secondValue,
          firstVisitedReferences,
          secondVisitedReferences,
          compareOptions,
        })
        expect(result).toEqual({
          returnCode: 'return',
          returnValue: false,
        })
      })

      it('should recurse with undefined value for visited element', () => {
        firstVisitedReferences.add('adapter.someType.instance.parent.first')
        const result = areReferencesEqual({
          first: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'parent', 'first')),
          second: secondValue,
          firstVisitedReferences,
          secondVisitedReferences,
          compareOptions,
        })
        expect(result).toEqual({
          returnCode: 'recurse',
          returnValue: {
            firstValue: undefined,
            secondValue,
          },
        })
      })
    })

    describe('compare by reference', () => {
      it('should return true when references are equal', () => {
        const result = areReferencesEqual({
          first: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'parent', 'element')),
          second: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'parent', 'element')),
          firstVisitedReferences,
          secondVisitedReferences,
        })
        expect(result).toEqual({
          returnCode: 'return',
          returnValue: true,
        })
      })

      it('should return false when references are different', () => {
        const result = areReferencesEqual({
          first: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'parent', 'first')),
          second: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'parent', 'second')),
          firstVisitedReferences,
          secondVisitedReferences,
        })
        expect(result).toEqual({
          returnCode: 'return',
          returnValue: false,
        })
      })

      it('should return false when first is a reference and second is a value', () => {
        const result = areReferencesEqual({
          first: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'parent', 'first')),
          second: secondValue,
          firstVisitedReferences,
          secondVisitedReferences,
        })
        expect(result).toEqual({
          returnCode: 'return',
          returnValue: false,
        })
      })
    })
  })

  describe('compareSpecialValues', () => {
    describe('compare by value', () => {
      const options = {
        compareByValue: true,
      }

      it('should return true for static files with identical content and different paths', () => {
        const result = compareSpecialValues(
          new StaticFile({
            filepath: 'path/to/file',
            hash: 'hash',
          }),
          new StaticFile({
            filepath: 'path/to/file2',
            hash: 'hash',
          }),
          options,
        )
        expect(result).toEqual(true)
      })

      it('should return true for resolved references with the same value', () => {
        const result = compareSpecialValues(
          new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'parent', 'first'), 42),
          new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'parent', 'second'), 42),
          options,
        )
        expect(result).toEqual(true)
      })
    })

    describe('compare by reference', () => {
      it('should return true for identical strings', () => {
        const result = compareSpecialValues('abcd123', 'abcd123')
        expect(result).toEqual(true)
      })

      it('should return true for strings that differ only by newline type', () => {
        const result = compareSpecialValues('abcd\n123', 'abcd\r\n123')
        expect(result).toEqual(true)
      })

      it('should return true for static files with identical content paths', () => {
        const result = compareSpecialValues(
          new StaticFile({
            filepath: 'path/to/file',
            hash: 'hash',
          }),
          new StaticFile({
            filepath: 'path/to/file',
            hash: 'hash',
          }),
        )
        expect(result).toEqual(true)
      })

      it('should return true for references to the same element', () => {
        const result = compareSpecialValues(
          new ReferenceExpression(new ElemID('adapter', 'someType'), 42),
          new ReferenceExpression(new ElemID('adapter', 'someType')),
        )
        expect(result).toEqual(true)
      })

      it('should return undefined for mismatched types', () => {
        const result = compareSpecialValues('abcd123', 42)
        expect(result).toBeUndefined()
      })

      it('should return false for type and reference', () => {
        const result = compareSpecialValues(new ReferenceExpression(new ElemID('adapter', 'someType')), 42)
        expect(result).toEqual(false)
      })
    })
  })

  describe('isEqualValues', () => {
    it('should return true for equal values', () => {
      const result = isEqualValues(42, 42)
      expect(result).toEqual(true)
    })
  })
})
