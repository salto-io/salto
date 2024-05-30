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
import { creds, CredsLease } from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import OktaClient from '../src/client/client'
import OktaAdapter, { OktaAdapterParams } from '../src/adapter'
import { Credentials } from '../src/auth'
import { DEFAULT_CONFIG, OktaConfig } from '../src/config'
import { credsSpec } from './jest_environment'
import { getAdminUrl } from '../src/client/admin'

const log = logger(module)

export type Reals = {
  client: OktaClient
  adapter: OktaAdapter
}

export type Opts = {
  adapterParams?: Partial<OktaAdapterParams>
  credentials: Credentials
  elementsSource: ReadOnlyElementsSource
}

export const realAdapter = ({ adapterParams, credentials, elementsSource }: Opts, config?: OktaConfig): Reals => {
  const client = (adapterParams && adapterParams.client) || new OktaClient({ credentials })
  const adminUrl = getAdminUrl(credentials.baseUrl)
  const adminClient =
    adminUrl !== undefined ? new OktaClient({ credentials: { ...credentials, baseUrl: adminUrl } }) : undefined
  const adapter = new OktaAdapter({
    client,
    config: config ?? DEFAULT_CONFIG,
    elementsSource,
    adminClient,
    isOAuthLogin: false,
  })
  return { client, adapter }
}

export const credsLease = (): Promise<CredsLease<Required<Credentials>>> => creds(credsSpec(), log)
