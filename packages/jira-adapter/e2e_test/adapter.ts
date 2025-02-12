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
import JiraClient from '../src/client/client'
import ScriptRunnerClient from '../src/client/script_runner_client'
import JiraAdapter, { JiraAdapterParams } from '../src/adapter'
import { Credentials } from '../src/auth'
import { getDefaultConfig, JiraConfig } from '../src/config/config'
import { credsSpec } from './jest_environment'

const log = logger(module)

type Reals = {
  client: JiraClient
  adapter: JiraAdapter
}

type Opts = {
  adapterParams?: Partial<JiraAdapterParams>
  credentials: Credentials
  elementsSource: ReadOnlyElementsSource
  isDataCenter?: boolean
  enableScriptRunner?: boolean
}

export const realAdapter = (
  { adapterParams, credentials, elementsSource, isDataCenter = false, enableScriptRunner = true }: Opts,
  jiraConfig?: JiraConfig,
): Reals => {
  const client =
    (adapterParams && adapterParams.client) ||
    new JiraClient({ credentials: { ...credentials, isDataCenter }, isDataCenter })
  const scriptRunnerClient = new ScriptRunnerClient({
    jiraClient: client,
    credentials: {},
    isDataCenter,
  })
  const config = jiraConfig ?? getDefaultConfig({ isDataCenter })
  config.fetch.enableScriptRunnerAddon = enableScriptRunner
  config.fetch.enableNewWorkflowAPI = true
  config.fetch.enableIssueLayouts = true
  config.fetch.enableJSM = true
  config.fetch.enableJsmExperimental = true
  const adapter = new JiraAdapter({
    client,
    config,
    elementsSource,
    scriptRunnerClient,
  })
  return { client, adapter }
}

export const credsLease = (isDataCenter = false): Promise<CredsLease<Required<Credentials>>> =>
  creds(credsSpec(isDataCenter), log)
