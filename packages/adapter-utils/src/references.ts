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

import { ElemID, Element, isReferenceExpression, ReferenceExpression, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { TransformFunc } from './utils'
import { walkOnElement, WalkOnFunc, WALK_NEXT_STEP } from './walk_element'

const isReferenceOfElement = <T>(value: T, elemId?: ElemID): boolean =>
  isReferenceExpression(value) &&
  (elemId === undefined || elemId.isEqual(value.elemID) || elemId.isParentOf(value.elemID))

export const getUpdatedReference = (
  referenceExpression: ReferenceExpression,
  targetElemId: ElemID,
): ReferenceExpression =>
  new ReferenceExpression(
    targetElemId.createNestedID(...referenceExpression.elemID.createTopLevelParentID().path),
    referenceExpression.value,
    referenceExpression.topLevelParent,
  )

export const createReferencesTransformFunc =
  (sourceElemId: ElemID, targetElemId: ElemID): TransformFunc =>
  ({ value }) =>
    isReferenceOfElement(value, sourceElemId) ? getUpdatedReference(value, targetElemId) : value

export const getReferences = (
  element: Element,
  sourceElemId?: ElemID,
): { path: ElemID; value: ReferenceExpression }[] => {
  const references: { path: ElemID; value: ReferenceExpression }[] = []
  const func: WalkOnFunc = ({ path, value }) => {
    if (isReferenceOfElement(value, sourceElemId)) {
      references.push({ path, value })
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element, func })
  return references
}

export const isArrayOfRefExprToInstances = (values: unknown): values is ReferenceExpression[] =>
  _.isArray(values) && values.every(isReferenceExpression) && values.every(value => isInstanceElement(value.value))
