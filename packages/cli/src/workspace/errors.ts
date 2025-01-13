/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { errors as wsErrors, validator as wsValidator } from '@salto-io/workspace'
import { ElemID, SaltoError, SaltoElementError, SeverityLevel } from '@salto-io/adapter-api'
import { ERROR_MESSAGES } from '@salto-io/adapter-utils'

const { isUnresolvedRefError } = wsValidator

export class UnresolvedReferenceGroupError implements SaltoElementError {
  readonly elemID: ElemID
  readonly detailedMessage: string
  readonly severity: SeverityLevel
  constructor(target: string, refErrors: ReadonlyArray<wsErrors.UnresolvedReferenceValidationError>) {
    const [firstError] = refErrors
    this.elemID = firstError.elemID
    this.detailedMessage = `Unresolved reference to ${target} in ${refErrors.length} places - if this was removed on purpose you may continue`
    this.severity = 'Warning'
  }

  message = ERROR_MESSAGES.UNRESOLVED_REFERENCE
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
