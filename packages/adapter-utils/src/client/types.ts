/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ClientBaseConfig } from './config'

export type ApiConnectionBaseConfig = {
  baseUrl: string
}

export type ClientOptsBase = {
  config?: ClientBaseConfig
  api: ApiConnectionBaseConfig
}

export type ClientGetParams = {
  endpointName: string
  queryArgs?: Record<string, string>
  recursiveQueryArgs?: Record<string, (entry: Values) => string>
  paginationField?: string
}
