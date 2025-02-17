/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, SaltoElementError, SeverityLevel } from '@salto-io/adapter-api'

export const ERROR_MESSAGES = {
  OTHER_ISSUES: 'Other issues',
  INVALID_NACL_CONTENT: 'Element has invalid NaCl content',
  UNRESOLVED_REFERENCE: 'Element has unresolved references',
  ID_COLLISION: 'Some elements were not fetched due to Salto ID collisions',
}

export const createSaltoElementErrorFromError = ({
  error,
  severity,
  elemID,
}: {
  error: Error
  severity: SeverityLevel
  elemID: ElemID
}): SaltoElementError => ({ message: error.message, detailedMessage: error.message, severity, elemID })

export const createSaltoElementError = ({
  message,
  detailedMessage,
  severity,
  elemID,
}: {
  message: string
  detailedMessage: string
  severity: SeverityLevel
  elemID: ElemID
}): SaltoElementError => ({ message, detailedMessage, severity, elemID })
