/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
