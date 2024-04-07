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
import { walkOnElement, WalkOnFunc, WALK_NEXT_STEP, getIndependentElemIDs } from '@salto-io/adapter-utils'
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
          message: 'Element has unresolved references',
          detailedMessage: `Element ${element.elemID.getFullName()} contains unresolved references: ${unresolvedReferences.map(e => e.getFullName()).join(', ')}. Add the missing dependencies and try again. To learn more about fixing this error, go to https://help.salto.io/en/articles/6947056-element-contains-unresolved-references`,
          unresolvedElemIds: unresolvedReferences,
          type: 'unresolvedReferences' as SaltoErrorType,
        }
      })
      .filter(values.isDefined)
      .toArray()
