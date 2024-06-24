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

import { logger } from '@salto-io/logging'
import { creds, CredsLease } from '@salto-io/e2e-credentials-store'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { Element, ElemID, ServiceIds } from '@salto-io/adapter-api'
import Bottleneck from 'bottleneck'
import { Credentials, toCredentialsAccountId } from '../src/client/credentials'
import SdfClient from '../src/client/sdf_client'
import NetsuiteAdapter, { NetsuiteAdapterParams } from '../src/adapter'
import { NetsuiteConfig } from '../src/config/types'
import { credsSpec } from './jest_environment'
import NetsuiteClient from '../src/client/client'
import SuiteAppClient from '../src/client/suiteapp_client/suiteapp_client'
import { instanceLimiterCreator, fullFetchConfig } from '../src/config/config_creator'

const log = logger(module)

type Opts = {
  adapterParams?: Partial<NetsuiteAdapterParams>
  elements?: Element[]
  credentials: Required<Credentials>
  withSuiteApp: boolean
}

const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string): ElemID =>
  new ElemID(adapterName, name)

export const realAdapter = (
  { adapterParams, credentials, withSuiteApp, elements = [] }: Opts,
  config?: NetsuiteConfig,
): { client: NetsuiteClient; adapter: NetsuiteAdapter } => {
  const netsuiteCredentials = {
    ...credentials,
    accountId: toCredentialsAccountId(credentials.accountId),
  }
  const globalLimiter = new Bottleneck({ maxConcurrent: 4 })
  const client =
    (adapterParams && adapterParams.client) ||
    new NetsuiteClient(
      new SdfClient({
        credentials: netsuiteCredentials,
        config: config?.client,
        globalLimiter,
        instanceLimiter: instanceLimiterCreator(config?.client),
      }),
      withSuiteApp
        ? new SuiteAppClient({
            credentials: netsuiteCredentials,
            config: config?.suiteAppClient,
            globalLimiter,
            instanceLimiter: instanceLimiterCreator(config?.client),
          })
        : undefined,
    )
  const adapter = new NetsuiteAdapter({
    client,
    elementsSource: buildElementsSourceFromElements(elements),
    config: config ?? { fetch: fullFetchConfig() },
    ...(adapterParams || { getElemIdFunc: mockGetElemIdFunc }),
  })
  return { client, adapter }
}

export const credsLease = (): Promise<CredsLease<Required<Credentials>>> => creds(credsSpec(), log)
