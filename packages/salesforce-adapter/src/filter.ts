/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { filter } from '@salto-io/adapter-utils'
import SalesforceClient from './client/client'
import { ConfigChangeSuggestion, FetchProfile, LastChangeDateOfTypesWithNestedInstances } from './types'

export type FilterContext = {
  unsupportedSystemFields?: string[]
  systemFields?: string[]
  enumFieldPermissions?: boolean
  fetchProfile: FetchProfile
  elementsSource: ReadOnlyElementsSource
  separateFieldToFiles?: string[]
  flsProfiles: string[]
  lastChangeDateOfTypesWithNestedInstances?: LastChangeDateOfTypesWithNestedInstances
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

export type FilterResult = filterUtils.FilterResult & {
  configSuggestions?: ConfigChangeSuggestion[]
}

export type Filter = filter.Filter<FilterResult>

// Local filters only use information in existing elements
// They can change the format of elements, but cannot use external sources of information
type LocalFilterOpts = Pick<FilterOpts, 'config'>
export type LocalFilterCreator = filter.FilterCreator<FilterResult, LocalFilterOpts>

// Remote filters can add more information to existing elements
// They should not change the format of existing elements, they should focus only on adding
// the new information
type RemoteFilterOpts = Pick<FilterOpts, 'config' | 'client'>
export type RemoteFilterCreator = filter.RemoteFilterCreator<FilterResult, RemoteFilterOpts>

// Files filters can run on folders and get additional context from the list of available files
type FilesFilterOpts = Pick<FilterOpts, 'config' | 'files'>
export type FilesFilterCreator = filter.FilterCreator<FilterResult, FilesFilterOpts>

export type LocalFilterCreatorDefinition = filter.LocalFilterCreatorDefinition<FilterResult, LocalFilterOpts>
export type RemoteFilterCreatorDefinition = filter.RemoteFilterCreatorDefinition<FilterResult, RemoteFilterOpts>
