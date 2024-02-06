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
import { HTTPReadClientInterface, HTTPWriteClientInterface } from '../../../client'
import { EndpointByPathAndMethod } from './endpoint'

export type RESTApiClientDefinition<
  PaginationOptions extends string,
> = {
  httpClient: HTTPReadClientInterface & HTTPWriteClientInterface

  // when specified, the additional args will be expected to appear in the context
  // TODON if exposing here, should use to validate as though these are additional args passed to the endpoint
  clientArgs?: Record<string, string>

  // the endpoints the client supports
  // Note: other endpoints can be called as well, and will use the default definition.
  endpoints: EndpointByPathAndMethod<PaginationOptions>
}

/**
 * Api client definitions. Initially only REST is supported, but this can be extended.
 */
export type ApiClientDefinition<
  PaginationOptions extends string,
> =
  RESTApiClientDefinition<PaginationOptions>
