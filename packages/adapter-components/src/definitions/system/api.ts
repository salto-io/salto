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
import { ActionName } from '@salto-io/adapter-api'
import { ApiClientDefinition, PaginationDefinitions } from './requests'
import { OptionsWithDefault } from './shared'
import { OpenAPIDefinition } from './sources'
import { FetchApiDefinitions } from './fetch'
import { ReferenceDefinitions } from './references'

export type ApiDefinitions<
  ClientOptions extends string = 'main',
  PaginationOptions extends string | 'none' = 'none',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _Action extends string = ActionName
> = {
  // sources are processed and used to populate initial options for clients and components, in order of definition,
  // followed by the rest of the adjustments
  sources?: {
    openAPI?: OpenAPIDefinition<ClientOptions>[]
  }

  // TODO add auth definitions
  // auth: AuthDefinitions

  // clients will be initialized as part of a big "client" in the adapter creator,
  // but need to be "registered" here in order to be used by the infra
  clients: OptionsWithDefault<ApiClientDefinition<PaginationOptions>, ClientOptions>

  // supported pagination options. when missing, no pagination is used (TODO add warning)
  pagination: Record<PaginationOptions, PaginationDefinitions<ClientOptions>>

  // rules for reference extraction (during fetch) and serialization (during deploy)
  references?: ReferenceDefinitions

  fetch?: FetchApiDefinitions<ClientOptions>
}
