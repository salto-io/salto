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
import _ from 'lodash'
// eslint-disable-next-line import/no-cycle
import { areReferencesEqual, shouldResolve } from './reference_comparison'
// eslint-disable-next-line import/no-cycle
import { CompareOptions, Value, isReferenceExpression, isStaticFile } from './values'

/*
  Benchmarking reveals that looping on strings is extremely expensive.
  It seems that random access to a string is, for some reason, a bit expensive.
  Using "replace" takes about 30 times as much as a straightforward comparison.
  However, it's about 20 times better to use replace than to iterate over both strings.
  For this reason we first check a naive comparison, and then test with replace.
*/
const compareStringsIgnoreNewlineDifferences = (s1: string, s2: string): boolean =>
  (s1 === s2) || (s1.replace(/\r\n/g, '\n') === s2.replace(/\r\n/g, '\n'))

const shouldCompareByValue = (
  first: Value,
  second: Value,
  options?: CompareOptions,
): boolean => Boolean(options?.compareByValue)
  && shouldResolve(first)
  && shouldResolve(second)


const compareSpecialValuesWithCircularRefs = (
  first: Value,
  second: Value,
  sourceComparedReferences: Set<string>,
  targetComparedReferences: Set<string>,
  options?: CompareOptions,
): boolean | undefined => {
  if (isStaticFile(first) && isStaticFile(second)) {
    return first.isEqual(second)
      && (options?.compareByValue
        ? true
        : first.filepath === second.filepath)
  }
  if (isReferenceExpression(first) || isReferenceExpression(second)) {
    if (shouldCompareByValue(first, second, options)) {
      const referencesCompareResult = areReferencesEqual({
        first,
        second,
        firstVisitedReferences: sourceComparedReferences,
        secondVisitedReferences: targetComparedReferences,
        compareOptions: options,
      })

      if (referencesCompareResult.returnCode === 'return') {
        return referencesCompareResult.returnValue
      }

      return _.isEqualWith(
        referencesCompareResult.returnValue.firstValue,
        referencesCompareResult.returnValue.secondValue,
        (va1, va2) => compareSpecialValuesWithCircularRefs(
          va1,
          va2,
          sourceComparedReferences,
          targetComparedReferences,
          options
        ),
      )
    }

    if (isReferenceExpression(first) && isReferenceExpression(second)) {
      return first.elemID.isEqual(second.elemID)
    }
    // If one side is a reference and the other is not and we should not
    // compare by values then the values are different
    return false
  }
  if (typeof first === 'string' && typeof second === 'string') {
    return compareStringsIgnoreNewlineDifferences(first, second)
  }
  return undefined
}


export const compareSpecialValues = (
  first: Value,
  second: Value,
  options?: CompareOptions,
): boolean | undefined =>
  compareSpecialValuesWithCircularRefs(first, second, new Set(), new Set(), options)

export const isEqualValues = (
  first: Value,
  second: Value,
  options?: CompareOptions,
): boolean => _.isEqualWith(
  first,
  second,
  (va1, va2) => compareSpecialValues(va1, va2, options),
)
