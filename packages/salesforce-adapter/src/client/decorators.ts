/*
*                      Copyright 2022 Salto Labs Ltd.
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
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { decorators, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ERROR_CODE_TO_USER_VISIBLE_ERROR, isMappableErrorCode } from './user_facing_errors'

const log = logger(module)
const { isDefined } = values

const JSFORCE_ERROR_SCHEMA = Joi.object({
  errorCode: Joi.string().required(),
}).unknown(true).required()

export type JSForceError = Error & {
  errorCode: string
}

const isJSForceError = createSchemeGuard<JSForceError, Error>(JSFORCE_ERROR_SCHEMA)

const getErrorCode = (jsforceError: JSForceError): number | undefined => {
  const errorCode = Number(_.last(jsforceError.errorCode.split('_')))
  if (Number.isNaN(errorCode)) {
    log.warn('Could not parse JSForce errorCode: %s', jsforceError.errorCode)
    return undefined
  }
  return errorCode
}

export const mapErrors = decorators.wrapMethodWith(
  async (original: decorators.OriginalCall): Promise<unknown> => {
    try {
      return await Promise.resolve(original.call())
    } catch (e: unknown) {
      if (_.isError(e) && isJSForceError(e)) {
        const errorCode = getErrorCode(e)
        if (isDefined(errorCode) && isMappableErrorCode(errorCode)) {
          e.message = ERROR_CODE_TO_USER_VISIBLE_ERROR[errorCode]
        }
      }
      throw e
    }
  }
)
