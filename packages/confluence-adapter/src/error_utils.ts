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
import { isSaltoElementError, isSaltoError } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'

export const customConvertError: deployment.ConvertError = (elemID, error) => {
  if (isSaltoError(error) && isSaltoElementError(error)) {
    return error
  }
  const isWrongVersionError = (
    err: unknown,
  ): err is { response: { data: { errors: { title: string }[] }; status: string } } => {
    const errorsArray = _.get(err, 'response.data.errors')
    const status = _.get(err, 'response.status')
    return (
      status === 409 &&
      Array.isArray(errorsArray) &&
      errorsArray.length > 0 &&
      _.isString(errorsArray[0].title) &&
      errorsArray[0].title.startsWith('Version')
    )
  }
  const extractErrorMessageFromErrorArray = (err: unknown): string | undefined =>
    isWrongVersionError(err) ? err.response.data.errors[0].title : undefined

  const message = extractErrorMessageFromErrorArray(error) ?? error.message
  return { elemID, message, severity: 'Error' }
}
