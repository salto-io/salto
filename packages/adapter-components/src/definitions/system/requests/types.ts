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
import { Values } from '@salto-io/adapter-api'
import { Response, ResponseValue } from '../../../client'
import { ArgsWithCustomizer } from '../shared/types'

export type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'

export type HTTPEndpointIdentifier<ClientOptions extends string> = {
  // specify the client to use to call the endpoint - defaults to the default client as specified in client.default
  client?: ClientOptions
  path: string
  // when not specified, the method is assumed to be 'get'
  method?: HTTPMethod
}

export type RequestArgs = {
  headers?: Record<string, string>
  queryArgs?: Record<string, string>
  params?: Record<string, Values>
  // TODO allow x-www-form-urlencoded + URLSearchParams, but not in a structured way yet?
  body?: unknown
}

export type HTTPEndpointDetails<PaginationOptions extends string | 'none'> = RequestArgs & {
  omitBody?: boolean

  // override default expected HTTP codes
  checkSuccess?: ArgsWithCustomizer< // TODON use
    boolean,
    // TODON decide on name
    { httpSuccessCodes: number[] },
    Response<ResponseValue | ResponseValue[]>
  >

  // the strategy to use to get all response pages
  pagination?: PaginationOptions

  // set this to mark as endpoint as safe for fetch. other endpoints can only be called during deploy.
  readonly?: boolean // TDOON validate!
}
