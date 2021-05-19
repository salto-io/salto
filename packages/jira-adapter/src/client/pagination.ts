/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { client as clientUtils } from '@salto-io/adapter-components'

const log = logger(module)
const { mapAsync, handleErrorsAsync } = collections.asynciterable
const { getWithOffsetAndLimit } = clientUtils

const removeScopedObjects = <T extends unknown>(response: T): T => {
  if (Array.isArray(response)) {
    return response
      .filter(item => !(_.isPlainObject(item) && Object.keys(item).includes('scope')))
      .map(removeScopedObjects) as T
  }
  if (_.isObject(response)) {
    return _.mapValues(response, removeScopedObjects) as T
  }
  return response
}

const suppressPageNotFoundError = (error: Error): void => {
  // The http_client code catches the original error and transforms it such that it removes
  // the parsed information (like the status code), so we have to parse the string here in order
  // to realize what type of error was thrown
  if (error.message.endsWith('Request failed with status code 404')) {
    log.warn('%o', error)
    return
  }
  throw error
}

export const pageByOffsetWithoutScopes: clientUtils.GetAllItemsFunc = args => (
  mapAsync(
    handleErrorsAsync(
      getWithOffsetAndLimit(args),
      suppressPageNotFoundError,
    ),
    removeScopedObjects,
  )
)
