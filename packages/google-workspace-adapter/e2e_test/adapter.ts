/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { creds, CredsLease } from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import { ReadOnlyElementsSource, AdapterOperations, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { adapter as googleWorkspaceAdapter } from '../src/adapter_creator'
import { Credentials, credentialsType } from '../src/auth'
import { DEFAULT_CONFIG, UserConfig } from '../src/config'
import { credsSpec } from './jest_environment'

const log = logger(module)

export type Reals = {
  adapter: AdapterOperations
}

type Opts = {
  credentials: Credentials
  elementsSource: ReadOnlyElementsSource
}

export const realAdapter = ({ credentials, elementsSource }: Opts, config?: UserConfig): Reals => {
  const adapter = googleWorkspaceAdapter
  const operations = adapter.operations({
    credentials: new InstanceElement('config', credentialsType, credentials),
    config: new InstanceElement('config', adapter.configType as ObjectType, config ?? DEFAULT_CONFIG),
    elementsSource,
  })
  return { adapter: operations }
}

export const credsLease = (): Promise<CredsLease<Required<Credentials>>> => creds(credsSpec(), log)
