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
import { ClientBaseParams, HTTPReadClientInterface, HTTPWriteClientInterface, ResponseValue } from '../../../client'
import { ContextParams } from '../shared'
import { HTTPEndpointIdentifier, RequestArgs } from './types'

export type ClientRequestArgsNoPath = Omit<ClientBaseParams, 'url'>

export type PaginationFunc = <ClientOptions extends string>({
  responseData,
  currentParams,
  responseHeaders,
  endpointIdentifier,
}: {
  responseData: ResponseValue | ResponseValue[]
  currentParams: ClientRequestArgsNoPath
  responseHeaders?: Record<string, unknown>
  endpointIdentifier: HTTPEndpointIdentifier<ClientOptions>
}) => ClientRequestArgsNoPath[] // TODON change response value?

export type PaginationFuncCreator<ClientOptions extends string> = (args: {
  client: HTTPReadClientInterface & HTTPWriteClientInterface
  endpointIdentifier: HTTPEndpointIdentifier<ClientOptions>
  params: ContextParams
}) => PaginationFunc

export type PaginationDefinitions<ClientOptions extends string> = {
  funcCreator: PaginationFuncCreator<ClientOptions>
  clientArgs?: RequestArgs
}
