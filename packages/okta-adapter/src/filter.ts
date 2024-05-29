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
import { filterUtils, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import { OldOktaDefinitionsConfig } from './config'
import { User } from './user_utils'
import { ClientOptions, PaginationOptions } from './definitions/types'
import { OktaUserConfig } from './user_config'

export const { filterRunner } = filterUtils

export type Filter = filterUtils.Filter<filterUtils.FilterResult>
export type FilterResult = filterUtils.FilterResult

export type FilterAdditionalParams = {
  fetchQuery: elementUtils.query.ElementQuery
  oldApiDefinitions: OldOktaDefinitionsConfig // TODO remove as part of SALTO-5692
  usersPromise?: Promise<User[]>
  paginator: clientUtils.Paginator
  baseUrl: string
  isOAuthLogin: boolean
}

export type FilterCreator = filterUtils.AdapterFilterCreator<
  OktaUserConfig,
  filterUtils.FilterResult,
  FilterAdditionalParams,
  { clientOptions: ClientOptions; paginationOptions: PaginationOptions }
>
