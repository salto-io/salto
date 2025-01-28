/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { decorators, collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { inspectValue } from '@salto-io/adapter-utils'
import {
  SaltoError,
  InstanceElement,
  CORE_ANNOTATIONS,
  ReadOnlyElementsSource,
  Element,
  ElemID,
} from '@salto-io/adapter-api'
import {
  ENOTFOUND,
  ERROR_HTTP_502,
  ERROR_PROPERTIES,
  INVALID_GRANT,
  isSalesforceError,
  SALESFORCE_DEPLOY_ERROR_MESSAGES,
  SALESFORCE_ERRORS,
  SalesforceError,
  VALIDATION_RULES_METADATA_TYPE,
} from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'

const { awu } = collections.asynciterable
const { DefaultMap } = collections.map
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

// Deploy Error Messages Mapping

export type DeployErrorMessageMapper = {
  test: (errorMessage: string) => boolean
  map: (saltoDeployError: SaltoError) => string
}

export type DeployErrorMessageMappers = {
  [SALESFORCE_DEPLOY_ERROR_MESSAGES.SCHEDULABLE_CLASS]: DeployErrorMessageMapper
  [SALESFORCE_DEPLOY_ERROR_MESSAGES.MAX_METADATA_DEPLOY_LIMIT]: DeployErrorMessageMapper
  [SALESFORCE_DEPLOY_ERROR_MESSAGES.INVALID_DASHBOARD_UNIQUE_NAME]: DeployErrorMessageMapper
  [SALESFORCE_DEPLOY_ERROR_MESSAGES.FIELD_CUSTOM_VALIDATION_EXCEPTION]: DeployErrorMessageMapper
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

export const FIELD_CUSTOM_VALIDATION_EXCEPTION_MESSAGE =
  'The element does not meet the validation rules. Try deactivating the validation rules if possible.'

export const DEPLOY_ERROR_MESSAGE_MAPPER: DeployErrorMessageMappers = {
  [SALESFORCE_DEPLOY_ERROR_MESSAGES.SCHEDULABLE_CLASS]: {
    test: (errorMessage: string) => errorMessage === SALESFORCE_DEPLOY_ERROR_MESSAGES.SCHEDULABLE_CLASS,
    map: (saltoDeployError: SaltoError) => withSalesforceError(saltoDeployError.message, SCHEDULABLE_CLASS_MESSAGE),
  },
  [SALESFORCE_DEPLOY_ERROR_MESSAGES.MAX_METADATA_DEPLOY_LIMIT]: {
    test: (errorMessage: string) => errorMessage === SALESFORCE_DEPLOY_ERROR_MESSAGES.MAX_METADATA_DEPLOY_LIMIT,
    map: (saltoDeployError: SaltoError) =>
      withSalesforceError(saltoDeployError.message, MAX_METADATA_DEPLOY_LIMIT_MESSAGE),
  },
  [SALESFORCE_DEPLOY_ERROR_MESSAGES.INVALID_DASHBOARD_UNIQUE_NAME]: {
    test: (errorMessage: string) =>
      errorMessage.includes(SALESFORCE_DEPLOY_ERROR_MESSAGES.INVALID_DASHBOARD_UNIQUE_NAME),
    map: (saltoDeployError: SaltoError) => `${saltoDeployError.message}\n${INVALID_DASHBOARD_UNIQUE_NAME_MESSAGE}`,
  },
  [SALESFORCE_DEPLOY_ERROR_MESSAGES.FIELD_CUSTOM_VALIDATION_EXCEPTION]: {
    test: (errorMessage: string) =>
      errorMessage.includes(SALESFORCE_DEPLOY_ERROR_MESSAGES.FIELD_CUSTOM_VALIDATION_EXCEPTION),
    map: (saltoDeployError: SaltoError) =>
      `${FIELD_CUSTOM_VALIDATION_EXCEPTION_MESSAGE}\n${saltoDeployError.detailedMessage}`,
  },
}

export const getUserFriendlyDeployErrorMessage = (saltoDeployError: SaltoError): string => {
  const userFriendlyMessageByMapperName = _.mapValues(
    _.pickBy(DEPLOY_ERROR_MESSAGE_MAPPER, mapper => mapper.test(saltoDeployError.message)),
    mapper => mapper.map(saltoDeployError),
  )
  const matchedMapperNames = Object.keys(userFriendlyMessageByMapperName)
  if (_.isEmpty(matchedMapperNames)) {
    return saltoDeployError.message
  }
  if (matchedMapperNames.length > 1) {
    log.error(
      'The error %s matched on more than one mapper. Matcher mappers: %s',
      saltoDeployError.message,
      inspectValue(matchedMapperNames),
    )
    return saltoDeployError.message
  }
  const [mapperName, userFriendlyMessage] = Object.entries(userFriendlyMessageByMapperName)[0]
  log.debug(
    'Replacing error %s message to %s. Original error: %s',
    mapperName,
    userFriendlyMessage,
    saltoDeployError.message,
  )
  return userFriendlyMessage
}

// Deploy Error message enrichment

type ValidationRule = InstanceElement & {
  value: InstanceElement['value'] & {
    errorMessage: string
  }
}

const isValidationRule = (instance: Element): instance is ValidationRule =>
  isInstanceOfTypeSync(VALIDATION_RULES_METADATA_TYPE)(instance) && _.isString(_.get(instance.value, 'errorMessage'))

const getValidationRulesMessages = (error: SaltoError): string[] => {
  const pattern = /FIELD_CUSTOM_VALIDATION_EXCEPTION:(.*?):--/g
  return [...error.message.matchAll(pattern)].map(match => match[1])
}

const createValidationRulesIndex = async (
  elementsSource: ReadOnlyElementsSource,
  groupTypeName: string,
): Promise<Map<string, ValidationRule[]>> => {
  const isGroupValidationRule = (id: ElemID): boolean =>
    id.typeName === VALIDATION_RULES_METADATA_TYPE && id.name.includes(groupTypeName)
  const validationRules = await awu(await elementsSource.list())
    .filter(isGroupValidationRule)
    .map(elementsSource.get)
    .filter(isValidationRule)
    .toArray()
  return validationRules.reduce(
    (acc: Map<string, ValidationRule[]>, validationRule) => {
      acc.get(validationRule.value.errorMessage)?.push(validationRule)
      return acc
    },
    new DefaultMap<string, ValidationRule[]>(() => []),
  )
}

const getValidationRulesUrls = (validationRules: ValidationRule[]): string[] =>
  validationRules.map(validationRule => validationRule.annotations[CORE_ANNOTATIONS.SERVICE_URL]).filter(_.isString)

const enrichValidationRulesDeployErrors = async (
  errors: readonly SaltoError[],
  elementsSource: ReadOnlyElementsSource,
  groupTypeName: string,
): Promise<readonly SaltoError[]> => {
  if (
    !errors.some(error => error.message.includes(SALESFORCE_DEPLOY_ERROR_MESSAGES.FIELD_CUSTOM_VALIDATION_EXCEPTION))
  ) {
    return errors
  }
  const validationRulesIndex: Map<string, ValidationRule[]> = await createValidationRulesIndex(
    elementsSource,
    groupTypeName,
  )
  return errors.map(error =>
    error.message.includes(SALESFORCE_DEPLOY_ERROR_MESSAGES.FIELD_CUSTOM_VALIDATION_EXCEPTION)
      ? {
          ...error,
          detailedMessage: `${getValidationRulesMessages(error)
            .map(validationRuleMessage => {
              const urls = getValidationRulesUrls(validationRulesIndex.get(validationRuleMessage) ?? [])
              if (urls.length === 0) {
                return `- **${validationRuleMessage}**.`
              }
              if (urls.length === 1) {
                return `- **${validationRuleMessage}**. [View in Salesforce](${urls[0]})`
              }
              const linkMessages = urls.map((url, index) => `   - [Link${index + 1}](${url})`).join('\n')
              return `- **${validationRuleMessage}**. Found multiple Validation Rules with this error message. Please review them:\n${linkMessages}`
            })
            .join('\n')}`,
        }
      : error,
  )
}

export const enrichSaltoDeployErrors = async (
  errors: readonly SaltoError[],
  elementsSource: ReadOnlyElementsSource,
  groupTypeName: string,
): Promise<readonly SaltoError[]> => enrichValidationRulesDeployErrors(errors, elementsSource, groupTypeName)
