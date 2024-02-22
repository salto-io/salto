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
  timeZoneAndFormat?: TimeZoneAndFormat
  changesGroupId?: string
  fetchTime?: Date
}

export type RemoteFilterOpts = LocalFilterOpts & {
  client: NetsuiteClient
}

export type LocalFilterCreator = filter.FilterCreator<void, LocalFilterOpts, DeployResult>
export type RemoteFilterCreator = filter.RemoteFilterCreator<void, RemoteFilterOpts, DeployResult>

export type LocalFilterCreatorDefinition = filter.LocalFilterCreatorDefinition<void, LocalFilterOpts, DeployResult>
export type RemoteFilterCreatorDefinition = filter.RemoteFilterCreatorDefinition<void, RemoteFilterOpts, DeployResult>
