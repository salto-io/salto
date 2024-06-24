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
import { regex } from '@salto-io/lowerdash'
import _ from 'lodash'

export class ConfigValidationError extends Error {
  constructor(fieldPath: string[], message: string) {
    super(
      `Failed to load config due to an invalid ${fieldPath.join('.')} value. ${message}`,
    )
  }
}

export const validateRegularExpressions = (
  regularExpressions: string[],
  fieldPath: string[],
): void => {
  const invalidRegularExpressions = regularExpressions.filter(
    (strRegex) => !regex.isValidRegex(strRegex),
  )
  if (!_.isEmpty(invalidRegularExpressions)) {
    const errMessage = `The following regular expressions are invalid: ${invalidRegularExpressions}`
    throw new ConfigValidationError(fieldPath, errMessage)
  }
}
