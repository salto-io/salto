/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { isSaltoElementError, isSaltoError } from '@salto-io/adapter-api'
import { deployment, client } from '@salto-io/adapter-components'

const getErrorMessage = (err: Error): string => {
  if (err instanceof client.HTTPError) {
    const responseMessage = _.get(err.response, 'data.error.message')
    return `${err.message}${responseMessage ? `: ${responseMessage}` : ''}`
  }
  return err.message
}

export const customConvertError: deployment.ConvertError = (elemID, error) => {
  if (isSaltoError(error) && isSaltoElementError(error)) {
    return error
  }

  const message = getErrorMessage(error)
  return { elemID, message, detailedMessage: message, severity: 'Error' }
}
