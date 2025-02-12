/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ReadOnlyElementsSource, Values } from '@salto-io/adapter-api'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import JiraClient from './client/client'
import { JiraConfig } from './config/config'
import { GetUserMapFunc } from './users'
import ScriptRunnerClient from './client/script_runner_client'

export const { filtersRunner } = filterUtils

export type Filter = filterUtils.Filter<filterUtils.FilterResult>
export type FilterResult = filterUtils.FilterResult

type FilterAdditionalParams = {
  elementsSource: ReadOnlyElementsSource
  fetchQuery: elementUtils.query.ElementQuery
  // A context for deployment that should be persistent across all the deployment steps.
  // Note that deployment steps can be executed in parallel so use this cautiously
  // and only when needed.
  adapterContext: Values
  getUserMapFunc: GetUserMapFunc
  scriptRunnerClient: ScriptRunnerClient
}

export type FilterCreator = filterUtils.FilterCreator<
  JiraClient,
  JiraConfig,
  filterUtils.FilterResult,
  FilterAdditionalParams
>
