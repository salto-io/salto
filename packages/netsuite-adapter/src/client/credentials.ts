/*
 *                      Copyright 2024 Salto Labs Ltd.
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
export type SuiteAppCredentials = {
  accountId: string
  suiteAppTokenId: string
  suiteAppTokenSecret: string
  suiteAppActivationKey?: string
}

export type SuiteAppSoapCredentials = Omit<SuiteAppCredentials, 'suiteAppActivationKey'>

export type SdfCredentials = {
  accountId: string
  tokenId: string
  tokenSecret: string
}

export type Credentials = SdfCredentials & Partial<SuiteAppCredentials>

export const isSuiteAppCredentials = (credentials: Credentials): credentials is SdfCredentials & SuiteAppCredentials =>
  credentials.suiteAppTokenId !== undefined && credentials.suiteAppTokenSecret !== undefined

export const isSdfCredentialsOnly = (credentials: Credentials): boolean =>
  credentials.suiteAppTokenId === undefined && credentials.suiteAppTokenSecret === undefined

export const toUrlAccountId = (accountId: string): string => accountId.toLowerCase().replace('_', '-')

// accountId must be uppercased as described in https://github.com/oracle/netsuite-suitecloud-sdk/issues/140
export const toCredentialsAccountId = (accountId: string): string => accountId.toUpperCase().replace('-', '_')
