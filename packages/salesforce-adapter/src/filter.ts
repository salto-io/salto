/*
 * Copyright 2025 Salto Labs Ltd.
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
  fetchProfile: FetchProfile
  elementsSource: ReadOnlyElementsSource
  separateFieldToFiles?: string[]
  flsProfiles: string[]
  lastChangeDateOfTypesWithNestedInstances?: LastChangeDateOfTypesWithNestedInstances
}

type FilterOpts = {
  client?: SalesforceClient
  config: FilterContext
}

export type FilterResult = filterUtils.FilterResult & {
  configSuggestions?: ConfigChangeSuggestion[]
}

export type Filter = filter.Filter<FilterResult>

export type FilterCreator = filter.FilterCreator<FilterResult, FilterOpts>
