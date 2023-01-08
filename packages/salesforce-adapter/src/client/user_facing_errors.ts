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

const REQUEST_LIMIT_EXCEEDED = 'sf:REQUEST_LIMIT_EXCEEDED'

const MAPPABLE_ERROR_NAMES = [
  'ERROR_HTTP_502',
  REQUEST_LIMIT_EXCEEDED,
] as const

export type MappableErrorName = typeof MAPPABLE_ERROR_NAMES[number]

export const ERROR_NAME_TO_FRIENDLY_ERROR_MESSAGE: Record<MappableErrorName, string> = {
  ERROR_HTTP_502: 'We are unable to connect to your Salesforce account right now. '
    + 'This might be an issue in Salesforce side. please check https://status.salesforce.com/current/incidents',
  [REQUEST_LIMIT_EXCEEDED]: 'Your Salesforce org has limited API calls for a 24-hour period. '
  + 'We are unable to connect to your org because this limit has been exceeded. '
  + 'Please try again later or contact your account executive to increase your API limit. ',
}

export const isMappableErrorName = (errorName: string): errorName is MappableErrorName => (
  (MAPPABLE_ERROR_NAMES as ReadonlyArray<string>).includes(errorName)
)
