/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { DeployMessage } from '@salto-io/jsforce'
import { decorators } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { inspectValue } from '@salto-io/adapter-utils'
import {
  ENOTFOUND,
  ERROR_HTTP_502,
  ERROR_PROPERTIES,
  INVALID_GRANT,
  isSalesforceError,
  SALESFORCE_DEPLOY_PROBLEMS,
  SALESFORCE_ERRORS,
  SalesforceError,
} from '../constants'

const log = logger(module)

export const REQUEST_LIMIT_EXCEEDED_MESSAGE =
  'Your Salesforce org has limited API calls for a 24-hour period. ' +
  'We are unable to connect to your org because this limit has been exceeded. ' +
  'Please try again later or contact your account executive to increase your API limit.'

export const MAX_CONCURRENT_REQUESTS_MESSAGE =
  'You have reached the maximum allowed concurrent API requests. ' +
  'For more information please refer to: https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm'

export const ERROR_HTTP_502_MESSAGE =
  'We are unable to connect to your Salesforce account right now. ' +
  'This might be an issue in Salesforce side. please check https://status.salesforce.com/current/incidents'

export const INVALID_GRANT_MESSAGE = 'Salesforce user is inactive, please re-authenticate'

export const EXPIRED_PASSWORD_MESSAGE = 'Your password is expired. Please login to your Salesforce account to renew it.'

export const INSUFFICIENT_ACCESS_MESSAGE =
  "You have no permissions to perform this action. Make sure the profile attached to your user has 'Modify All Data' and 'Modify Metadata Through Metadata API Functions' enabled."

type DNSException = Error & {
  [ERROR_PROPERTIES.CODE]: string
  [ERROR_PROPERTIES.HOSTNAME]: string
}

const isDNSException = (error: Error): error is DNSException =>
  _.isString(_.get(error, ERROR_PROPERTIES.CODE)) && _.isString(_.get(error, ERROR_PROPERTIES.HOSTNAME))

const CONNECTION_ERROR_HTML_PAGE_REGEX =
  /<html[^>]+>.*<head>.*<title>Error Page<\/title>.*<\/head>.*<body[^>]*>.*An unexpected connection error occurred.*<\/body>.*<\/html>/gs

type ErrorMapper<T extends Error> = {
  test: (error: Error) => error is T
  map: (error: T) => string
}

export type ErrorMappers = {
  [ERROR_HTTP_502]: ErrorMapper<Error>
  [SALESFORCE_ERRORS.REQUEST_LIMIT_EXCEEDED]: ErrorMapper<SalesforceError>
  [INVALID_GRANT]: ErrorMapper<Error>
  [ENOTFOUND]: ErrorMapper<DNSException>
  [SALESFORCE_ERRORS.EXPIRED_PASSWORD]: ErrorMapper<SalesforceError>
  [SALESFORCE_ERRORS.INSUFFICIENT_ACCESS]: ErrorMapper<Error>
}

export const withSalesforceError = (salesforceError: string, saltoErrorMessage: string): string =>
  `${saltoErrorMessage}\n\nUnderlying Error: ${salesforceError}`

export const ERROR_MAPPERS: ErrorMappers = {
  [ERROR_HTTP_502]: {
    test: (error: Error): error is Error =>
      error.message === ERROR_HTTP_502 || CONNECTION_ERROR_HTML_PAGE_REGEX.test(error.message),
    map: (error: Error): string => withSalesforceError(error.message, ERROR_HTTP_502_MESSAGE),
  },
  [SALESFORCE_ERRORS.REQUEST_LIMIT_EXCEEDED]: {
    test: (error: Error): error is SalesforceError =>
      isSalesforceError(error) && error[ERROR_PROPERTIES.ERROR_CODE] === SALESFORCE_ERRORS.REQUEST_LIMIT_EXCEEDED,
    map: (error: SalesforceError): string =>
      error.message.includes('TotalRequests Limit exceeded')
        ? withSalesforceError(error.message, REQUEST_LIMIT_EXCEEDED_MESSAGE)
        : withSalesforceError(error.message, MAX_CONCURRENT_REQUESTS_MESSAGE),
  },
  [INVALID_GRANT]: {
    test: (error: Error): error is Error => error.name === INVALID_GRANT,
    map: (error: Error): string => withSalesforceError(error.message, INVALID_GRANT_MESSAGE),
  },
  [ENOTFOUND]: {
    test: (error: Error): error is DNSException => isDNSException(error) && error.code === ENOTFOUND,
    map: (error: DNSException) =>
      withSalesforceError(
        error.message,
        `Unable to communicate with the salesforce org at ${error[ERROR_PROPERTIES.HOSTNAME]}.` +
          ' This may indicate that the org no longer exists, e.g. a sandbox that was deleted, or due to other network issues.',
      ),
  },
  [SALESFORCE_ERRORS.EXPIRED_PASSWORD]: {
    test: (error: Error): error is SalesforceError =>
      isSalesforceError(error) && error[ERROR_PROPERTIES.ERROR_CODE] === SALESFORCE_ERRORS.EXPIRED_PASSWORD,
    map: (error: Error): string => withSalesforceError(error.message, EXPIRED_PASSWORD_MESSAGE),
  },
  [SALESFORCE_ERRORS.INSUFFICIENT_ACCESS]: {
    test: (error: Error): error is SalesforceError =>
      isSalesforceError(error) && error[ERROR_PROPERTIES.ERROR_CODE] === SALESFORCE_ERRORS.INSUFFICIENT_ACCESS,
    map: (error: Error): string => withSalesforceError(error.message, INSUFFICIENT_ACCESS_MESSAGE),
  },
}

export const mapToUserFriendlyErrorMessages = decorators.wrapMethodWith(async original => {
  try {
    return await Promise.resolve(original.call())
  } catch (e) {
    if (!_.isError(e)) {
      throw e
    }
    const userFriendlyMessageByMapperName = _.mapValues(
      _.pickBy(ERROR_MAPPERS, mapper => mapper.test(e)),
      mapper => mapper.map(e),
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
})

// Deploy Problems Mapping

export type DeployProblemMapper = {
  test: (problem: string) => boolean
  map: (deployMessage: DeployMessage) => string
}

export type DeployProblemMappers = {
  [SALESFORCE_DEPLOY_PROBLEMS.SCHEDULABLE_CLASS]: DeployProblemMapper
  [SALESFORCE_DEPLOY_PROBLEMS.MAX_METADATA_DEPLOY_LIMIT]: DeployProblemMapper
  [SALESFORCE_DEPLOY_PROBLEMS.INVALID_DASHBOARD_UNIQUE_NAME]: DeployProblemMapper
}

export const SCHEDULABLE_CLASS_MESSAGE =
  'This deployment contains a scheduled Apex class (or a class related to one).' +
  ' By default, Salesforce does not allow changes to scheduled apex.' +
  ' Please follow the instructions here: https://help.salesforce.com/s/articleView?id=000384960&type=1'

export const MAX_METADATA_DEPLOY_LIMIT_MESSAGE =
  'The metadata deployment exceeded the maximum allowed size of 50MB.' +
  ' To avoid this issue, please split your deployment to smaller chunks.' +
  ' For more info you may refer to: https://help.salto.io/en/articles/8263355-the-metadata-deployment-exceeded-the-maximum-allowed-size-of-50mb'

export const INVALID_DASHBOARD_UNIQUE_NAME_MESSAGE =
  "Please make sure you're managing Dashboards in your Salto environment and that your deployment contains the referenced Dashboard instance.\n" +
  'For more information, please refer to: https://help.salto.io/en/articles/7439350-supported-salesforce-types'

export const DEPLOY_PROBLEM_MAPPER: DeployProblemMappers = {
  [SALESFORCE_DEPLOY_PROBLEMS.SCHEDULABLE_CLASS]: {
    test: (problem: string) => problem === SALESFORCE_DEPLOY_PROBLEMS.SCHEDULABLE_CLASS,
    map: (deployMessage: DeployMessage) => withSalesforceError(deployMessage.problem, SCHEDULABLE_CLASS_MESSAGE),
  },
  [SALESFORCE_DEPLOY_PROBLEMS.MAX_METADATA_DEPLOY_LIMIT]: {
    test: (problem: string) => problem === SALESFORCE_DEPLOY_PROBLEMS.MAX_METADATA_DEPLOY_LIMIT,
    map: (deployMessage: DeployMessage) =>
      withSalesforceError(deployMessage.problem, MAX_METADATA_DEPLOY_LIMIT_MESSAGE),
  },
  [SALESFORCE_DEPLOY_PROBLEMS.INVALID_DASHBOARD_UNIQUE_NAME]: {
    test: (problem: string) => problem.includes(SALESFORCE_DEPLOY_PROBLEMS.INVALID_DASHBOARD_UNIQUE_NAME),
    map: (deployMessage: DeployMessage) => `${deployMessage.problem}\n${INVALID_DASHBOARD_UNIQUE_NAME_MESSAGE}`,
  },
}

export const getUserFriendlyDeployMessage = (deployMessage: DeployMessage): DeployMessage => {
  const { problem } = deployMessage
  const userFriendlyMessageByMapperName = _.mapValues(
    _.pickBy(DEPLOY_PROBLEM_MAPPER, mapper => mapper.test(problem)),
    mapper => mapper.map(deployMessage),
  )
  const matchedMapperNames = Object.keys(userFriendlyMessageByMapperName)
  if (_.isEmpty(matchedMapperNames)) {
    return deployMessage
  }
  if (matchedMapperNames.length > 1) {
    log.error(
      'The error %s matched on more than one mapper. Matcher mappers: %s',
      problem,
      inspectValue(matchedMapperNames),
    )
    return deployMessage
  }
  const [mapperName, userFriendlyMessage] = Object.entries(userFriendlyMessageByMapperName)[0]
  log.debug('Replacing error %s message to %s. Original error: %o', mapperName, userFriendlyMessage, problem)
  return { ...deployMessage, problem: userFriendlyMessage }
}
