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
import { types } from '@salto-io/lowerdash'
import { ArgsWithCustomizer, ContextParams, EndpointExtractionParams } from '../shared'
import { ChangeAndContext } from './types'

export type ContextParamDefinitions = ArgsWithCustomizer<ContextParams, { args: ContextParams }>

export type DeployRequestEndpointDefinition<ClientOptions extends string = 'main'> = EndpointExtractionParams<
  ChangeAndContext,
  ClientOptions
>

export type DeployRequestDefinition<ClientOptions extends string = 'main'> = types.XOR<
  DeployRequestEndpointDefinition<ClientOptions>,
  // when true (and matched condition), return early without making additional requests
  { earlySuccess: true }
>
