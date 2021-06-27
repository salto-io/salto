/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ReadOnlyElementsSource, SaltoError } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import SalesforceClient from './client/client'
import { FetchProfile } from './fetch_profile/fetch_profile'
import { ConfigChangeSuggestion } from './types'


export type FilterContext = {
  unsupportedSystemFields?: string[]
  systemFields?: string[]
  useOldProfiles?: boolean
  fetchProfile: FetchProfile
  elementsSource: ReadOnlyElementsSource
}

export type FilterOpts = {
  client: SalesforceClient
  config: FilterContext
}

export type FilterResult = {
  configSuggestions?: ConfigChangeSuggestion[]
  errors?: SaltoError[]
}

export type Filter = filter.Filter<FilterResult>

export type FilterWith<M extends keyof Filter> = filter.FilterWith<FilterResult, M>

export type FilterCreator = filter.FilterCreator<FilterResult, FilterOpts>
