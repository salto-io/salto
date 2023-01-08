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

const ERROR_HTTP_502 = 'ERROR_HTTP_502'
const REQUEST_LIMIT_EXCEEDED = 'sf:REQUEST_LIMIT_EXCEEDED'
const INVALID_GRANT = 'invalid_grant'

const JSFORCE_MAPPABLE_ERROR_NAMES = [
  ERROR_HTTP_502,
  REQUEST_LIMIT_EXCEEDED,
  INVALID_GRANT,
] as const

export type JSForceMappableErrorName = typeof JSFORCE_MAPPABLE_ERROR_NAMES[number]

export const JSFORCE_ERROR_NAME_TO_FRIENDLY_ERROR_MESSAGE: Record<JSForceMappableErrorName, string> = {
  [ERROR_HTTP_502]: 'We are unable to connect to your Salesforce account right now. '
    + 'This might be an issue in Salesforce side. please check https://status.salesforce.com/current/incidents',
  [REQUEST_LIMIT_EXCEEDED]: 'Your Salesforce org has limited API calls for a 24-hour period. '
  + 'We are unable to connect to your org because this limit has been exceeded. '
  + 'Please try again later or contact your account executive to increase your API limit. ',
  [INVALID_GRANT]: 'Salesforce user is inactive, please re-authenticate',
}

export const isMappableJSForceErrorName = (errorName: string): errorName is JSForceMappableErrorName => (
  (JSFORCE_MAPPABLE_ERROR_NAMES as ReadonlyArray<string>).includes(errorName)
)
