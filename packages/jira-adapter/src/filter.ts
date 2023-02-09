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
import { ReadOnlyElementsSource, SaltoError, Values } from '@salto-io/adapter-api'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import JiraClient from './client/client'
import { JiraConfig } from './config/config'
import { GetUserMapFunc } from './users'

export const { filtersRunner } = filterUtils

export type FilterResult = {
  errors?: SaltoError[]
}

export type Filter = filterUtils.Filter<FilterResult>

export type FilterAdditionParams = {
  elementsSource: ReadOnlyElementsSource
  fetchQuery: elementUtils.query.ElementQuery
  // A context for deployment that should be persistent across all the deployment steps.
  // Note that deployment steps can be executed in parallel so use this cautiously
  // and only when needed.
  adapterContext: Values
  getUserMapFunc: GetUserMapFunc
}

export type FilterCreator = filterUtils.FilterCreator<
  JiraClient,
  JiraConfig,
  FilterResult,
  FilterAdditionParams
>
