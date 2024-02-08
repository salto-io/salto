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
import { ReadOnlyElementsSource, Values } from '@salto-io/adapter-api'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import OktaClient from './client/client'
import { OktaConfig } from './config'
import { User } from './user_utils'

export const { filtersRunner } = filterUtils

export type Filter = filterUtils.Filter<filterUtils.FilterResult>
export type FilterResult = filterUtils.FilterResult

export type FilterAdditionalParams = {
  elementsSource: ReadOnlyElementsSource
  fetchQuery: elementUtils.query.ElementQuery
  // A context for deployment that should be persistent across all the deployment steps.
  // Note that deployment steps can be executed in parallel so use this cautiously
  // and only when needed.
  adapterContext: Values
  adminClient?: OktaClient
  usersPromise?: Promise<User[]>
}

export type FilterCreator = filterUtils.FilterCreator<
  OktaClient,
  OktaConfig,
  filterUtils.FilterResult,
  FilterAdditionalParams
>
