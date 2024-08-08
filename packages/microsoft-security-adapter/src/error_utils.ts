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

  return { elemID, message: getErrorMessage(error), severity: 'Error' }
}
