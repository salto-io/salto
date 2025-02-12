/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { creds, CredsLease } from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import ZuoraClient from '../src/client/client'
import ZuoraAdapter, { ZuoraAdapterParams } from '../src/adapter'
import { Credentials, OAuthClientCredentials } from '../src/auth'
import { ZuoraConfig, FETCH_CONFIG, API_DEFINITIONS_CONFIG, DEFAULT_API_DEFINITIONS } from '../src/config'
import { credsSpec } from './jest_environment'

const log = logger(module)

type Reals = {
  client: ZuoraClient
  adapter: ZuoraAdapter
}

type Opts = {
  adapterParams?: Partial<ZuoraAdapterParams>
  credentials: Credentials
}

export const realAdapter = ({ adapterParams, credentials }: Opts, config?: ZuoraConfig): Reals => {
  const client = (adapterParams && adapterParams.client) || new ZuoraClient({ credentials })
  const adapter = new ZuoraAdapter({
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

export const credsLease = (): Promise<CredsLease<Required<OAuthClientCredentials>>> => creds(credsSpec(), log)
