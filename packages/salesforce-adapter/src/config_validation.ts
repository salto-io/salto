/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { regex } from '@salto-io/lowerdash'
import _ from 'lodash'

export class ConfigValidationError extends Error {
  constructor(fieldPath: string[], message: string) {
    super(`Failed to load config due to an invalid ${fieldPath.join('.')} value. ${message}`)
  }
}

export const validateRegularExpressions = (regularExpressions: string[], fieldPath: string[]): void => {
  const invalidRegularExpressions = regularExpressions.filter(strRegex => !regex.isValidRegex(strRegex))
  if (!_.isEmpty(invalidRegularExpressions)) {
    const errMessage = `The following regular expressions are invalid: ${invalidRegularExpressions}`
    throw new ConfigValidationError(fieldPath, errMessage)
  }
}
