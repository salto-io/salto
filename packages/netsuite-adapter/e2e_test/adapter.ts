/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Credentials } from '../src/client/credentials'
import NetsuiteClient from '../src/client/client'
import NetsuiteAdapter, { NetsuiteAdapterParams } from '../src/adapter'
import { NetsuiteConfig } from '../src/config'
import { CLIENT_CONFIG } from '../src/constants'
import { mockGetElemIdFunc } from '../test/utils'
import { credsSpec } from './jest_environment'


const log = logger(module)

type Opts = {
  adapterParams?: Partial<NetsuiteAdapterParams>
  credentials: Credentials
}

export const realAdapter = ({ adapterParams, credentials }: Opts, config?: NetsuiteConfig):
  { client: NetsuiteClient; adapter: NetsuiteAdapter } => {
  const client = (adapterParams && adapterParams.client) || new NetsuiteClient({
    credentials,
    config: config?.[CLIENT_CONFIG],
  })
  const adapter = new NetsuiteAdapter({
    client,
    elementsSource: buildElementsSourceFromElements([]),
    config: config ?? {},
    ...adapterParams || { getElemIdFunc: mockGetElemIdFunc },
  })
  return { client, adapter }
}

export const credsLease = (): Promise<CredsLease<Credentials>> => creds(credsSpec(), log)
