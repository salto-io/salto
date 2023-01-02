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


const MAPPABLE_ERROR_CODES = [
  502,
] as const

type MappableErrorCode = typeof MAPPABLE_ERROR_CODES[number]

const VISIBLE_ERROR_502 = 'We are unable to connect to your Salesforce account right now. '
    + 'This is either an issue on the Salesforce side (please check https://status.salesforce.com/current/incidents) '
    + 'or on the Salto side (please check https://status.salto.io/ or contact support@salto.io)'

export const ERROR_CODE_TO_USER_VISIBLE_ERROR: Record<MappableErrorCode, string> = {
  502: VISIBLE_ERROR_502,
}

export const isMappableErrorCode = (errorCode: number): errorCode is MappableErrorCode => (
  (MAPPABLE_ERROR_CODES as ReadonlyArray<number>).includes(errorCode)
)
