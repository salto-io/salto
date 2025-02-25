/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  Element,
  ElemID,
  SeverityLevel,
  isReferenceExpression,
  isTemplateExpression,
  isAdditionOrModificationChange,
  UnresolvedReference,
  UnresolvedReferenceError,
  SaltoErrorType,
} from '@salto-io/adapter-api'
import {
  walkOnElement,
  WalkOnFunc,
  WALK_NEXT_STEP,
  getIndependentElemIDs,
  ERROR_MESSAGES,
} from '@salto-io/adapter-utils'
import { values, collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

type ElemIDPredicate = (id: ElemID) => boolean

const getOutgoingUnresolvedReferences = (element: Element, shouldIgnore: ElemIDPredicate): ElemID[] => {
  const unresolvedReferences: ElemID[] = []
  const func: WalkOnFunc = ({ value, path }) => {
    if (shouldIgnore(path)) {
      return WALK_NEXT_STEP.RECURSE
    }

    if (isReferenceExpression(value) && value.value instanceof UnresolvedReference) {
      unresolvedReferences.push(value.elemID)
      return WALK_NEXT_STEP.SKIP
    }
    if (isTemplateExpression(value)) {
      value.parts.forEach(part => {
        if (isReferenceExpression(part) && part.value instanceof UnresolvedReference) {
          unresolvedReferences.push(part.elemID)
        }
      })
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element, func })
  return unresolvedReferences
}

export const createOutgoingUnresolvedReferencesValidator =
  (shouldIgnore: ElemIDPredicate = () => false): ChangeValidator<UnresolvedReferenceError> =>
  async changes =>
    awu(changes)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .map(async element => {
        const unresolvedReferences = getIndependentElemIDs(getOutgoingUnresolvedReferences(element, shouldIgnore))

        if (unresolvedReferences.length === 0) {
          return undefined
        }
        return {
          elemID: element.elemID,
          severity: 'Error' as SeverityLevel,
          message: ERROR_MESSAGES.UNRESOLVED_REFERENCE,
          detailedMessage: `This element contains unresolved references: ${unresolvedReferences.map(e => e.getFullName()).join(', ')}. Add the missing dependencies and try again. To learn more about fixing this error, go to https://help.salto.io/en/articles/6947056-element-contains-unresolved-references`,
          unresolvedElemIds: unresolvedReferences,
          type: 'unresolvedReferences' as SaltoErrorType,
        }
      })
      .filter(values.isDefined)
      .toArray()
