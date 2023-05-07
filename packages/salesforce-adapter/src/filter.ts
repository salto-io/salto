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
import { ReadOnlyElementsSource, SaltoError } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import SalesforceClient from './client/client'
import { FetchProfile } from './fetch_profile/fetch_profile'
import { ConfigChangeSuggestion } from './types'

export type FilterContext = {
  unsupportedSystemFields?: string[]
  systemFields?: string[]
  enumFieldPermissions?: boolean
  fetchProfile: FetchProfile
  elementsSource: ReadOnlyElementsSource
  separateFieldToFiles?: string[]
}

type FilterFilesContext = {
  baseDirName: string
  sourceFileNames: string[]
  staticFileNames: string[]
}

export type FilterOpts = {
  client: SalesforceClient
  config: FilterContext
  files: FilterFilesContext
}

export type FilterResult = {
  configSuggestions?: ConfigChangeSuggestion[]
  errors?: SaltoError[]
}

export type Filter = filter.Filter<FilterResult>

// Local filters only use information in existing elements
// They can change the format of elements, but cannot use external sources of information
type LocalFilterOpts = Pick<FilterOpts, 'config'>
export type LocalFilterCreator = filter.LocalFilterCreator<FilterResult, LocalFilterOpts>

// Remote filters can add more information to existing elements
// They should not change the format of existing elements, they should focus only on adding
// the new information
type RemoteFilterOpts = Pick<FilterOpts, 'config' | 'client'>
export type RemoteFilterCreator = filter.RemoteFilterCreator<FilterResult, RemoteFilterOpts>

// Files filters can run on folders and get additional context from the list of available files
type FilesFilterOpts = Pick<FilterOpts, 'config' | 'files'>
export type FilesFilterCreator = filter.LocalFilterCreator<FilterResult, FilesFilterOpts>

export type LocalFilterCreatorDefinition = filter.LocalFilterCreatorDefinition<FilterResult, LocalFilterOpts>
export type RemoteFilterCreatorDefinition = filter.RemoteFilterCreatorDefinition<FilterResult, RemoteFilterOpts>
