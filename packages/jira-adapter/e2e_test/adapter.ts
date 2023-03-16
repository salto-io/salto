/*
*                      Copyright 2023 Salto Labs Ltd.
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
import JiraClient from '../src/client/client'
import JiraAdapter, { JiraAdapterParams } from '../src/adapter'
import { Credentials } from '../src/auth'
import { getDefaultConfig, JiraConfig } from '../src/config/config'
import { credsSpec } from './jest_environment'

const log = logger(module)

export type Reals = {
  client: JiraClient
  adapter: JiraAdapter
}

export type Opts = {
  adapterParams?: Partial<JiraAdapterParams>
  credentials: Credentials
  elementsSource: ReadOnlyElementsSource
  isDataCenter?: boolean
  enableScriptRunner?: boolean
}

export const realAdapter = (
  { adapterParams, credentials, elementsSource, isDataCenter = false, enableScriptRunner = true }: Opts,
  jiraConfig?: JiraConfig
): Reals => {
  const client = (adapterParams && adapterParams.client)
    || new JiraClient({ credentials, isDataCenter })
  const config = jiraConfig ?? getDefaultConfig({ isDataCenter })
  config.fetch.enableScriptRunnerAddon = enableScriptRunner
  const adapter = new JiraAdapter({
    client,
    config,
    elementsSource,
  })
  return { client, adapter }
}

export const credsLease = (isDataCenter = false)
: Promise<CredsLease<Required<Credentials>>> => creds(
  credsSpec(isDataCenter),
  log,
)
