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
import { ENOTFOUND, ERROR_HTTP_502, INVALID_GRANT, SF_REQUEST_LIMIT_EXCEEDED } from '../constants'

const log = logger(module)
const { isDefined } = values


/**
 * To allow more robust support and avoid boilerplate
 * for supporting different Error objects (e.g. Node DNSError, JSForce error)
 * this values can be any of the Error object properties.
 */
export const MAPPABLE_ERROR_PROPERTIES = [
  ERROR_HTTP_502,
  SF_REQUEST_LIMIT_EXCEEDED,
  INVALID_GRANT,
  ENOTFOUND,
] as const

export type MappableErrorProperty = typeof MAPPABLE_ERROR_PROPERTIES[number]

type MapErrorFunc = (error: Error) => string

export const REQUEST_LIMIT_EXCEEDED_MESSAGE = 'Your Salesforce org has limited API calls for a 24-hour period. '
    + 'We are unable to connect to your org because this limit has been exceeded. '
    + 'Please try again later or contact your account executive to increase your API limit.'

export const MAX_CONCURRENT_REQUESTS_MESSAGE = 'You have reached the maximum allowed concurrent API requests. '
    + 'For more information please refer to: https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm'

export const ERROR_HTTP_502_MESSAGE = 'We are unable to connect to your Salesforce account right now. '
  + 'This might be an issue in Salesforce side. please check https://status.salesforce.com/current/incidents'

export const INVALID_GRANT_MESSAGE = 'Salesforce user is inactive, please re-authenticate'

export const ENOTFOUND_MESSAGE = 'Unable to communicate with the salesforce org.'
  + 'This may indicate that the org no longer exists, e.g. a sandbox that was deleted, or due to other network issues.'

const mapRequestLimitExceededError: MapErrorFunc = (error: Error) => (
  error.message.includes('TotalRequests Limit exceeded')
    ? REQUEST_LIMIT_EXCEEDED_MESSAGE
    : MAX_CONCURRENT_REQUESTS_MESSAGE
)

const ERROR_MAPPERS: Record<MappableErrorProperty, string | MapErrorFunc> = {
  [ERROR_HTTP_502]: ERROR_HTTP_502_MESSAGE,
  [SF_REQUEST_LIMIT_EXCEEDED]: mapRequestLimitExceededError,
  [INVALID_GRANT]: INVALID_GRANT_MESSAGE,
  [ENOTFOUND]: ENOTFOUND_MESSAGE,
}

export const isMappableErrorProperty = (errorProperty: string): errorProperty is MappableErrorProperty => (
  (MAPPABLE_ERROR_PROPERTIES as ReadonlyArray<string>).includes(errorProperty)
)

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
      const mappableError = Object.values(e)
        .filter(_.isString)
        .find(isMappableErrorProperty)
      if (isDefined(mappableError)) {
        const stringOrFunction = ERROR_MAPPERS[mappableError]
        const userVisibleErrorMessage = _.isString(stringOrFunction)
          ? stringOrFunction
          : stringOrFunction(e)
        log.debug('Replacing error %s message to %s. Original error: %o', mappableError, userVisibleErrorMessage, e)
        e.message = userVisibleErrorMessage
      }
      throw e
    }
  }
)
