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

import { DeployMessage } from 'jsforce'
import { decorators, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  ENOTFOUND,
  ERROR_HTTP_502,
  ERROR_PROPERTIES,
  INVALID_GRANT,
  isSalesforceError, SALESFORCE_ERRORS,
} from '../constants'

const log = logger(module)
const { isDefined } = values

export const MAPPABLE_ERROR_NAME = [
  ERROR_HTTP_502,
  SALESFORCE_ERRORS.REQUEST_LIMIT_EXCEEDED,
  INVALID_GRANT,
  ENOTFOUND,
] as const

export type MappableErrorName = typeof MAPPABLE_ERROR_NAME[number]

type GetUserFriendlyErrorFunc = (error: Error) => string | undefined

export const REQUEST_LIMIT_EXCEEDED_MESSAGE = 'Your Salesforce org has limited API calls for a 24-hour period. '
    + 'We are unable to connect to your org because this limit has been exceeded. '
    + 'Please try again later or contact your account executive to increase your API limit.'

export const MAX_CONCURRENT_REQUESTS_MESSAGE = 'You have reached the maximum allowed concurrent API requests. '
    + 'For more information please refer to: https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm'

export const ERROR_HTTP_502_MESSAGE = 'We are unable to connect to your Salesforce account right now. '
  + 'This might be an issue in Salesforce side. please check https://status.salesforce.com/current/incidents'

export const INVALID_GRANT_MESSAGE = 'Salesforce user is inactive, please re-authenticate'

type DNSException = Error & {
  [ERROR_PROPERTIES.CODE]: string
  [ERROR_PROPERTIES.HOSTNAME]: string
}

const isDNSException = (error: Error): error is DNSException => (
  _.isString(_.get(error, ERROR_PROPERTIES.CODE)) && _.isString(_.get(error, ERROR_PROPERTIES.HOSTNAME))
)

const ERROR_MAPPERS: Record<MappableErrorName, GetUserFriendlyErrorFunc> = {
  [ERROR_HTTP_502]: (error: Error) => (
    error.message === ERROR_HTTP_502
      ? ERROR_HTTP_502_MESSAGE
      : undefined
  ),
  [SALESFORCE_ERRORS.REQUEST_LIMIT_EXCEEDED]: (error: Error) => {
    if (!isSalesforceError(error) || error[ERROR_PROPERTIES.ERROR_CODE] !== SALESFORCE_ERRORS.REQUEST_LIMIT_EXCEEDED) {
      return undefined
    }
    return error.message.includes('TotalRequests Limit exceeded')
      ? REQUEST_LIMIT_EXCEEDED_MESSAGE
      : MAX_CONCURRENT_REQUESTS_MESSAGE
  },
  [INVALID_GRANT]: (error: Error) => (
    error.name === INVALID_GRANT
      ? INVALID_GRANT_MESSAGE
      : undefined
  ),
  [ENOTFOUND]: (error: Error) => (
    isDNSException(error) && error.code === ENOTFOUND
      ? `Unable to communicate with the salesforce org at ${error[ERROR_PROPERTIES.HOSTNAME]}.`
      + 'This may indicate that the org no longer exists, e.g. a sandbox that was deleted, or due to other network issues.'
      : undefined
  ),
}

// Deploy Errors Mapping

const SCHEDULABLE_CLASS = 'This schedulable class has jobs pending or in progress'

const MAPPABLE_SALESFORCE_PROBLEMS = [
  SCHEDULABLE_CLASS,
] as const

export type MappableSalesforceProblem = typeof MAPPABLE_SALESFORCE_PROBLEMS[number]

const isMappableSalesforceProblem = (problem: string): problem is MappableSalesforceProblem => (
  (MAPPABLE_SALESFORCE_PROBLEMS as ReadonlyArray<string>).includes(problem)
)

export const MAPPABLE_PROBLEM_TO_USER_FRIENDLY_MESSAGE: Record<MappableSalesforceProblem, string> = {
  [SCHEDULABLE_CLASS]: 'This deployment contains a scheduled Apex class (or a class related to one).'
  + 'By default, Salesforce does not allow changes to scheduled apex. '
  + 'Please follow the instructions here: https://help.salesforce.com/s/articleView?id=000384960&type=1',
}

export const getUserFriendlyDeployMessage = (deployMessage: DeployMessage): DeployMessage => ({
  ...deployMessage,
  problem: isMappableSalesforceProblem(deployMessage.problem)
    ? MAPPABLE_PROBLEM_TO_USER_FRIENDLY_MESSAGE[deployMessage.problem]
    : deployMessage.problem,
})

export const mapToUserFriendlyErrorMessages = decorators.wrapMethodWith(
  async original => {
    try {
      return await Promise.resolve(original.call())
    } catch (e) {
      const userVisibleErrorByMapper = _(ERROR_MAPPERS)
        .mapValues(func => func(e))
        .pickBy(isDefined)
        .valueOf()
      if (_.isEmpty(userVisibleErrorByMapper)) {
        throw e
      }
      const matchedMapperNames = Object.keys(userVisibleErrorByMapper)
      if (matchedMapperNames.length > 1) {
        log.error('The error %o matched on more than one mapper. Mapper names: %o', e, matchedMapperNames)
        throw e
      }
      const [errorName, userVisibleErrorMessage] = Object.entries(userVisibleErrorByMapper)[0]
      log.debug('Replacing error %s message to %s. Original error: %o', errorName, userVisibleErrorMessage, e)
      e.message = userVisibleErrorMessage
      throw e
    }
  }
)
