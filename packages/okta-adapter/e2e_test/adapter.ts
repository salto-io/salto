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
import OktaClient from '../src/client/client'
import OktaAdapter, { OktaAdapterParams } from '../src/adapter'
import { Credentials } from '../src/auth'
import { credsSpec } from './jest_environment'
import { getAdminUrl } from '../src/client/admin'
import { OktaUserConfig, DEFAULT_CONFIG } from '../src/user_config'

const log = logger(module)

export type Reals = {
  client: OktaClient
  adapter: OktaAdapter
}

type Opts = {
  adapterParams?: Partial<OktaAdapterParams>
  credentials: Credentials
  elementsSource: ReadOnlyElementsSource
}

export const realAdapter = ({ adapterParams, credentials, elementsSource }: Opts, config?: OktaUserConfig): Reals => {
  const client = (adapterParams && adapterParams.client) || new OktaClient({ credentials })
  const adminUrl = getAdminUrl(credentials.baseUrl)
  const adminClient =
    adminUrl !== undefined ? new OktaClient({ credentials: { ...credentials, baseUrl: adminUrl } }) : undefined
  const adapter = new OktaAdapter({
    client,
    userConfig: config ?? DEFAULT_CONFIG,
    elementsSource,
    adminClient,
    isOAuthLogin: false,
    accountName: 'okta',
  })
  return { client, adapter }
}

export const credsLease = (): Promise<CredsLease<Required<Credentials>>> => creds(credsSpec(), log)
