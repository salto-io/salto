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

const ERROR_HTTP_502 = 'ERROR_HTTP_502'
const REQUEST_LIMIT_EXCEEDED = 'sf:REQUEST_LIMIT_EXCEEDED'
const INVALID_GRANT = 'invalid_grant'
const ENOTFOUND = 'ENOTFOUND'


/**
 * To allow more robust support and avoid boilerplate
 * for supporting different Error objects (e.g. Node DNSError, JSForce error)
 * this values can be any of the Error object properties.
 */
const MAPPABLE_ERROR_PROPERTIES = [
  ERROR_HTTP_502,
  REQUEST_LIMIT_EXCEEDED,
  INVALID_GRANT,
  ENOTFOUND,
] as const

export type MappableErrorProperty = typeof MAPPABLE_ERROR_PROPERTIES[number]

export const MAPPABLE_ERROR_TO_USER_FRIENDLY_MESSAGE: Record<MappableErrorProperty, string> = {
  [ERROR_HTTP_502]: 'We are unable to connect to your Salesforce account right now. '
    + 'This might be an issue in Salesforce side. please check https://status.salesforce.com/current/incidents',
  [REQUEST_LIMIT_EXCEEDED]: 'Your Salesforce org has limited API calls for a 24-hour period. '
  + 'We are unable to connect to your org because this limit has been exceeded. '
  + 'Please try again later or contact your account executive to increase your API limit. ',
  [INVALID_GRANT]: 'Salesforce user is inactive, please re-authenticate',
  [ENOTFOUND]: 'Unable to communicate with the salesforce org.'
  + 'This may indicate that the org no longer exists, e.g. a sandbox that was deleted, or due to other network issues.',
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
