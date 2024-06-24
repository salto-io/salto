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

import { FixElementsFunc, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { APIDefinitionsOptions, ResolveCustomNameMappingOptionsType, UserConfig } from '../definitions'

export type FixElementsArgs<
  Options extends APIDefinitionsOptions,
  Co extends UserConfig<ResolveCustomNameMappingOptionsType<Options>>,
> = {
  config: Co
  elementsSource: ReadOnlyElementsSource
}

export type FixElementsHandler<
  Options extends APIDefinitionsOptions,
  Co extends UserConfig<ResolveCustomNameMappingOptionsType<Options>>,
> = (args: FixElementsArgs<Options, Co>) => FixElementsFunc
