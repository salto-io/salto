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
import ZendeskClient from '../src/client/client'
import ZendeskAdapter, { ZendeskAdapterParams } from '../src/adapter'
import { DEFAULT_CONFIG } from '../src/config'
import { Credentials } from '../src/auth'
import { credsSpec } from './jest_environment'

const log = logger(module)

export type Reals = {
  client: ZendeskClient
  adapter: ZendeskAdapter
}

export type Opts = {
  adapterParams?: Partial<ZendeskAdapterParams>
  credentials: Credentials
  elementsSource: ReadOnlyElementsSource
}

export const realAdapter = ({ adapterParams, credentials, elementsSource }: Opts, config = DEFAULT_CONFIG): Reals => {
  const client = (adapterParams && adapterParams.client) || new ZendeskClient({ credentials, config: config.client })
  const adapter = new ZendeskAdapter({ client, credentials, config, elementsSource })
  return { client, adapter }
}

export const credsLease = (): Promise<CredsLease<Credentials>> => creds(credsSpec(), log)
