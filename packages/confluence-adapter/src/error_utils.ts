/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { isSaltoElementError, isSaltoError } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'

const log = logger(module)

type SuppressedErrorChecker = (err: Error) => boolean

const isJavaNullPointerErrorOrUndefined: SuppressedErrorChecker = err => {
  const status = _.get(err, 'response.status')
  const message = _.get(err, 'response.data.message')
  return status === 500 && message.startsWith('java.lang.NullPointerException: Cannot invoke')
}

const SUPPRESSED_ERRORS_CHECKER_LIST: SuppressedErrorChecker[] = [isJavaNullPointerErrorOrUndefined]

const shouldSuppressError = (err: Error): boolean => SUPPRESSED_ERRORS_CHECKER_LIST.some(checkFunc => checkFunc(err))

const getWrongVersionErrorOrUndefined = (err: Error): string | undefined => {
  const errorsArray = _.get(err, 'response.data.errors')
  const status = _.get(err, 'response.status')
  if (
    status === 409 &&
    Array.isArray(errorsArray) &&
    errorsArray.length > 0 &&
    _.isString(errorsArray[0].title) &&
    errorsArray[0].title.startsWith('Version')
  ) {
    return errorsArray[0].title
  }
  return undefined
}
const getErrorMessage = (err: Error): string => getWrongVersionErrorOrUndefined(err) ?? err.message

export const customConvertError: deployment.ConvertError = (elemID, error) => {
  if (isSaltoError(error) && isSaltoElementError(error)) {
    return error
  }
  if (shouldSuppressError(error)) {
    log.debug('Suppressing error: %s', error)
    return undefined
  }
  const message = getErrorMessage(error)
  return { elemID, message, detailedMessage: message, severity: 'Error' }
}
