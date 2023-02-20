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
import { decorators } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  ENOTFOUND,
  ERROR_HTTP_502,
  ERROR_PROPERTIES,
  INVALID_GRANT,
  isSalesforceError, SALESFORCE_ERRORS, SalesforceError,
} from '../constants'

const log = logger(module)

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

type ErrorMapper<T extends Error> = {
  test: (error: Error) => error is T
  map: (error: T) => string
}

export type ErrorMappers = {
  [ERROR_HTTP_502]: ErrorMapper<Error>
  [SALESFORCE_ERRORS.REQUEST_LIMIT_EXCEEDED]: ErrorMapper<SalesforceError>
  [INVALID_GRANT]: ErrorMapper<Error>
  [ENOTFOUND]: ErrorMapper<DNSException>
}

export const ERROR_MAPPERS: ErrorMappers = {
  [ERROR_HTTP_502]: {
    test: (error: Error): error is Error => error.message === ERROR_HTTP_502,
    map: (_error: Error): string => ERROR_HTTP_502_MESSAGE,
  },
  [SALESFORCE_ERRORS.REQUEST_LIMIT_EXCEEDED]: {
    test: (error: Error): error is SalesforceError => (
      isSalesforceError(error) && error[ERROR_PROPERTIES.ERROR_CODE] === SALESFORCE_ERRORS.REQUEST_LIMIT_EXCEEDED
    ),
    map: (error: SalesforceError): string => (
      error.message.includes('TotalRequests Limit exceeded')
        ? REQUEST_LIMIT_EXCEEDED_MESSAGE
        : MAX_CONCURRENT_REQUESTS_MESSAGE
    ),
  },
  [INVALID_GRANT]: {
    test: (error: Error): error is Error => error.name === INVALID_GRANT,
    map: (_error: Error): string => INVALID_GRANT_MESSAGE,
  },
  [ENOTFOUND]: {
    test: (error: Error): error is DNSException => (
      isDNSException(error) && error.code === ENOTFOUND
    ),
    map: (error: DNSException) => (
      `Unable to communicate with the salesforce org at ${error[ERROR_PROPERTIES.HOSTNAME]}.`
      + ' This may indicate that the org no longer exists, e.g. a sandbox that was deleted, or due to other network issues.'
    ),
  },
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
      if (!_.isError(e)) {
        throw e
      }
      const userFriendlyMessageByMapperName = _.mapValues(
        _.pickBy(
          ERROR_MAPPERS,
          mapper => mapper.test(e)
        ),
        mapper => mapper.map(e)
      )

      const matchedMapperNames = Object.keys(userFriendlyMessageByMapperName)
      if (_.isEmpty(matchedMapperNames)) {
        throw e
      } else if (matchedMapperNames.length > 1) {
        log.error('The error %o matched on more than one mapper. Matcher mappers: %o', e, matchedMapperNames)
        throw e
      }
      const [mapperName, userFriendlyMessage] = Object.entries(userFriendlyMessageByMapperName)[0]
      log.debug('Replacing error %s message to %s. Original error: %o', mapperName, userFriendlyMessage, e)
      e.message = userFriendlyMessage
      throw e
    }
  }
)
