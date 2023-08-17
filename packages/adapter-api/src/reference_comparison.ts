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
// eslint-disable-next-line import/no-cycle
import { ReadOnlyElementsSource, isVariable } from './elements'
// eslint-disable-next-line import/no-cycle
import { CompareOptions, ReferenceExpression, Value, isReferenceExpression } from './values'

type ReferenceCompareReturnValue<T> = {
  returnCode: 'return'
  returnValue: boolean
} | {
  returnCode: 'recurse'
  returnValue: {
    firstValue: T
    secondValue: T
  }
}


const getReferenceValue = (
  reference: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource | undefined,
  visitedReferences: Set<string>,
): Value => {
  const targetId = reference.elemID.getFullName()
  if (visitedReferences.has(targetId)) {
    // Circular reference, to avoid infinite recursion we need to return something
    // the chosen behavior for now is to return "undefined"
    // this may cause circular references to compare equal if we compare to undefined
    // but this shouldn't matter much as we assume the user has already seen the warning
    // about having a circular reference before getting to this point
    return undefined
  }
  visitedReferences.add(targetId)
  return reference.value
    ?? reference.getResolvedValue(elementsSource).then(refValue => (isVariable(refValue) ? refValue.value : refValue))
}


export const shouldResolve = (value: unknown): boolean => (
  // We don't resolve references to elements because the logic of how to resolve each
  // reference currently exists only in the adapter so here we don't know how to
  // resolve them.
  // We do resolve variables because they always point to a primitive value that we can compare.
  // If a value is not a reference we decided to return that we should "resolve" it so
  // the value will be treated like a resolved reference
  !isReferenceExpression(value) || !value.elemID.isBaseID() || value.elemID.idType === 'var'
)

export function areReferencesEqual({
  first,
  second,
  firstSrc,
  secondSrc,
  firstVisitedReferences,
  secondVisitedReferences,
  compareOptions,
}: {
  first: Value
  second: Value
  firstSrc: ReadOnlyElementsSource
  secondSrc: ReadOnlyElementsSource
  firstVisitedReferences: Set<string>
  secondVisitedReferences: Set<string>
  compareOptions?: CompareOptions
}): ReferenceCompareReturnValue<Promise<Value>>

export function areReferencesEqual({
  first,
  second,
  firstVisitedReferences,
  secondVisitedReferences,
  compareOptions,
}: {
  first: Value
  second: Value
  firstVisitedReferences: Set<string>
  secondVisitedReferences: Set<string>
  compareOptions?: CompareOptions
}): ReferenceCompareReturnValue<Value>

export function areReferencesEqual({
  first,
  second,
  firstSrc,
  secondSrc,
  firstVisitedReferences,
  secondVisitedReferences,
  compareOptions,
}: {
  first: Value
  second: Value
  firstSrc?: ReadOnlyElementsSource
  secondSrc?: ReadOnlyElementsSource
  firstVisitedReferences: Set<string>
  secondVisitedReferences: Set<string>
  compareOptions?: CompareOptions
}): ReferenceCompareReturnValue<Value> {
  if (compareOptions?.compareByValue && shouldResolve(first) && shouldResolve(second)) {
    const shouldResolveFirst = isReferenceExpression(first)

    const firstValue = shouldResolveFirst
      ? getReferenceValue(first, firstSrc, firstVisitedReferences)
      : first

    const shouldResolveSecond = isReferenceExpression(second)

    const secondValue = shouldResolveSecond
      ? getReferenceValue(second, secondSrc, secondVisitedReferences)
      : second

    if (shouldResolveFirst || shouldResolveSecond) {
      return {
        returnCode: 'recurse',
        returnValue: {
          firstValue,
          secondValue,
        },
      }
    }
  }

  if (isReferenceExpression(first) && isReferenceExpression(second)) {
    return {
      returnCode: 'return',
      returnValue: first.elemID.isEqual(second.elemID),
    }
  }

  // if we got here, as we assume that one of the compared values is a ReferenceExpression,
  // we need to return false because a non-resolved reference isn't equal to a non-reference value
  return {
    returnCode: 'return',
    returnValue: false,
  }
}
