/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filter } from '@salto-io/adapter-utils'
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import NetsuiteClient from './client/client'
import { LazyElementsSourceIndexes } from './elements_source_index/types'
import { DeployResult } from './types'
import { NetsuiteConfig } from './config/types'
import { TimeZoneAndFormat } from './changes_detector/date_formats'

export type Filter = filter.Filter<void, DeployResult>

export type LocalFilterOpts = {
  elementsSourceIndex: LazyElementsSourceIndexes
  elementsSource: ReadOnlyElementsSource
  isPartial: boolean
  config: NetsuiteConfig
  internalIdToTypes: Record<string, string[]>
  typeToInternalId: Record<string, string>
  timeZoneAndFormat?: TimeZoneAndFormat
  changesGroupId?: string
  fetchTime?: Date
  suiteQLNameToInternalIdsMap?: Record<string, Record<string, string[]>>
}

export type RemoteFilterOpts = LocalFilterOpts & {
  client: NetsuiteClient
}

export type LocalFilterCreator = filter.FilterCreator<void, LocalFilterOpts, DeployResult>
export type RemoteFilterCreator = filter.RemoteFilterCreator<void, RemoteFilterOpts, DeployResult>

export type LocalFilterCreatorDefinition = filter.LocalFilterCreatorDefinition<void, LocalFilterOpts, DeployResult>
export type RemoteFilterCreatorDefinition = filter.RemoteFilterCreatorDefinition<void, RemoteFilterOpts, DeployResult>
