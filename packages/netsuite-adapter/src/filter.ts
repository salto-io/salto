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
import { filter } from '@salto-io/adapter-utils'
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import NetsuiteClient from './client/client'
import { LazyElementsSourceIndexes } from './elements_source_index/types'
import { DeployResult } from './types'
import { NetsuiteConfig } from './config'


export type Filter = filter.Filter<void, DeployResult>

export type FilterWith<M extends keyof Filter> = filter.FilterWith<void, M, DeployResult>

export type FilterOpts = {
  client: NetsuiteClient
  elementsSourceIndex: LazyElementsSourceIndexes
  elementsSource: ReadOnlyElementsSource
  isPartial: boolean
  config: NetsuiteConfig
  changesGroupId?: string
}

export type FilterCreator = filter.FilterCreator<
  void,
  FilterOpts,
  DeployResult
>
