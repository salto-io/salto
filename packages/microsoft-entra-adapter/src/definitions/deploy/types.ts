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
import { definitions } from '@salto-io/adapter-components'
import { AdditionalAction, ClientOptions } from '../types'

export type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<
  AdditionalAction,
  ClientOptions
>
export type DeployCustomDefinitions = Record<string, InstanceDeployApiDefinitions>
export type DeployRequestDefinition = definitions.deploy.DeployRequestDefinition<ClientOptions>
export type DeployableRequestDefinition = definitions.deploy.DeployableRequestDefinition<ClientOptions>
export type AdjustFunctionSingle = definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndContext>
