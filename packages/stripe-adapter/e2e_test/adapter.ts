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
import StripeClient from '../src/client/client'
import StripeAdapter, { StripeAdapterParams } from '../src/adapter'
import { Credentials, AccessTokenCredentials } from '../src/auth'
import { StripeConfig, FETCH_CONFIG, API_DEFINITIONS_CONFIG, DEFAULT_API_DEFINITIONS } from '../src/config'
import { credsSpec } from './jest_environment'

const log = logger(module)

export type Reals = {
  client: StripeClient
  adapter: StripeAdapter
}

export type Opts = {
  adapterParams?: Partial<StripeAdapterParams>
  credentials: Credentials
}

export const realAdapter = ({ adapterParams, credentials }: Opts, config?: StripeConfig): Reals => {
  const client = (adapterParams && adapterParams.client) || new StripeClient({ credentials })
  const adapter = new StripeAdapter({
    client,
    config: config ?? {
      [FETCH_CONFIG]: {
        // TODO for now not connected to a real account - update when connecting
        include: [],
        exclude: [],
      },
      [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
    },
  })
  return { client, adapter }
}

export const credsLease = (): Promise<CredsLease<Required<AccessTokenCredentials>>> => creds(credsSpec(), log)
