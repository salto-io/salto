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
import {
  AdapterOperations,
  ChangeValidator,
  DependencyChanger,
  ElemIdGetter,
  InstanceElement,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { types } from '@salto-io/lowerdash'
import { Client } from '../../client/client_creator'
import { UserConfig, ApiDefinitions } from '../../definitions'
import { AdapterFilterCreator, FilterResult } from '../../filter_utils'

export interface AdapterParams<
  Credentials,
  Co extends UserConfig,
  ClientOptions extends string = 'main',
  PaginationOptions extends string | 'none' = 'none',
  AdditionalAction extends string = never,
> {
  filterCreators: AdapterFilterCreator<
    UserConfig,
    FilterResult,
    {},
    ClientOptions,
    PaginationOptions,
    AdditionalAction
  >[]
  clients: Record<ClientOptions, Client<Credentials>>
  definitions: types.PickyRequired<
    ApiDefinitions<ClientOptions, PaginationOptions, AdditionalAction>,
    'clients' | 'pagination' | 'fetch'
  >
  config: Co
  configInstance?: InstanceElement
  getElemIdFunc?: ElemIdGetter
  additionalChangeValidators?: Record<string, ChangeValidator>
  dependencyChangers?: DependencyChanger[]
  elementSource: ReadOnlyElementsSource
  adapterName: string
  // TODO SALTO-5578 pass in account name as well
}

export interface AdapterImplConstructor<
  Credentials,
  Co extends UserConfig,
  ClientOptions extends string = 'main',
  PaginationOptions extends string | 'none' = 'none',
  AdditionalAction extends string = never,
> {
  new (args: AdapterParams<Credentials, Co, ClientOptions, PaginationOptions, AdditionalAction>): AdapterOperations
}
