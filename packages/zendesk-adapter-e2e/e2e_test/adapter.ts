/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { creds, CredsLease } from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import {
  ZendeskClient,
  DEFAULT_CONFIG,
  FETCH_CONFIG,
  Credentials,
  ZendeskAdapter,
  ZendeskAdapterParams,
} from '@salto-io/zendesk-adapter'
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
  config[FETCH_CONFIG].useNewInfra = true
  const client = (adapterParams && adapterParams.client) || new ZendeskClient({ credentials, config: config.client })
  const adapter = new ZendeskAdapter({ client, credentials, config, elementsSource, accountName: 'zendesk' })
  return { client, adapter }
}

export const credsLease = (): Promise<CredsLease<Credentials>> => creds(credsSpec(), log)
