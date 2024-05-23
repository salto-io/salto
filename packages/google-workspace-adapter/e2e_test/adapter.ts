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
import { ReadOnlyElementsSource, AdapterOperations, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { adapter as googleWorkspaceAdapter } from '../src/adapter_creator'
import { Credentials, credentialsType } from '../src/auth'
import { DEFAULT_CONFIG, UserConfig } from '../src/config'
import { credsSpec } from './jest_environment'

const log = logger(module)

export type Reals = {
  adapter: AdapterOperations
}

export type Opts = {
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
