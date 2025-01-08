/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { ElemID } from './element_id'

export type SeverityLevel = 'Error' | 'Warning' | 'Info'

export type SaltoErrorType = 'config' | 'dependency' | 'unresolvedReferences'

export type SaltoError = {
  message: string
  detailedMessage: string
  severity: SeverityLevel
  type?: SaltoErrorType
}

export type SaltoElementError = SaltoError & {
  elemID: ElemID
}

export const isSaltoElementError = (error: SaltoError | SaltoElementError): error is SaltoElementError =>
  'elemID' in error && error.elemID !== undefined

export const isSaltoError = (error: unknown): error is SaltoError =>
  _.isObject(error) && 'message' in error && 'severity' in error

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

export class CredentialError extends Error {}
