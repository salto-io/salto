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
import _ from 'lodash'
import { errors as wsErrors, validator as wsValidator } from '@salto-io/workspace'
import { ElemID, SaltoError, SaltoElementError, SeverityLevel } from '@salto-io/adapter-api'

const { isUnresolvedRefError } = wsValidator

export class UnresolvedReferenceGroupError implements SaltoElementError {
  readonly elemID: ElemID
  readonly message: string
  readonly severity: SeverityLevel
  constructor(target: string, refErrors: ReadonlyArray<wsErrors.UnresolvedReferenceValidationError>) {
    const [firstError] = refErrors
    this.elemID = firstError.elemID
    this.message = `Unresolved reference to ${target} in ${refErrors.length} places - if this was removed on purpose you may continue`
    this.severity = 'Warning'
  }
}

const groupUnresolvedRefsByTarget = (origErrors: ReadonlyArray<SaltoError>): ReadonlyArray<SaltoError> => {
  const [unresolvedRefs, other] = _.partition(origErrors, isUnresolvedRefError)
  const unresolvedTargets = new Set(unresolvedRefs.map(err => err.target.getFullName()))
  const getBaseUnresolvedTarget = (id: ElemID): string => {
    const parent = id.createParentID()
    return id.isTopLevel() || !unresolvedTargets.has(parent.getFullName())
      ? id.getFullName()
      : getBaseUnresolvedTarget(parent)
  }

  const groupedErrors = _(unresolvedRefs)
    .groupBy(err => getBaseUnresolvedTarget(err.target))
    .entries()
    .map(([baseTarget, errors]) =>
      errors.length > 1 ? new UnresolvedReferenceGroupError(baseTarget, errors) : errors[0],
    )
    .value()
  return [...groupedErrors, ...other]
}

export const groupRelatedErrors = (errors: ReadonlyArray<SaltoError>): ReadonlyArray<SaltoError> =>
  groupUnresolvedRefsByTarget(errors)
