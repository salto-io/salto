/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { decorators, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { MAPPABLE_ERROR_TO_USER_FRIENDLY_MESSAGE, isMappableErrorProperty } from './user_facing_errors'

const log = logger(module)
const { isDefined } = values

export const mapToUserFriendlyErrorMessages = decorators.wrapMethodWith(
  async (original: decorators.OriginalCall): Promise<unknown> => {
    try {
      return await Promise.resolve(original.call())
    } catch (e: unknown) {
      if (_.isError(e)) {
        const mappableError = Object.values(e)
          .filter(_.isString)
          .find(isMappableErrorProperty)
        if (isDefined(mappableError)) {
          log.debug('Replacing error %s. Original error: %o', mappableError, e)
          e.message = MAPPABLE_ERROR_TO_USER_FRIENDLY_MESSAGE[mappableError]
        }
      }
      throw e
    }
  }
)
