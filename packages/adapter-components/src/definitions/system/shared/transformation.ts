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
import { Values } from '@salto-io/adapter-api'
import { HTTPEndpointIdentifier, RequestArgs } from '../requests/types'

export const DATA_FIELD_ENTIRE_OBJECT = '.'

export type NameMappingOptions = 'lowercase' | 'uppercase'

export type NameMappingFunction = (name: unknown) => string

export type NameMappingFunctionMap<TCustomOptions extends string = never> = Record<
  // We need this exclusion for 2 reasons:
  // 1. In case TCustomOptions are not defined and fallback to the default options (NameMappingOptions), we don't want TS to enforce us to define their mapping
  // 2. We don't want to allow the default options logic to be overridden by a custom one
  Exclude<TCustomOptions, NameMappingOptions>,
  NameMappingFunction
>

export type ContextParams = Record<string, unknown>

export type GeneratedItem<TContext = ContextParams, TVal = unknown> = {
  typeName: string
  value: TVal
  // TODO also support binary values (for SALTO-5400)
  readonly context: ContextParams & TContext
}

export type TransformFunction<TContext = ContextParams, TSourceVal = Values, TTargetVal extends unknown = Values> = (
  item: GeneratedItem<ContextParams & TContext, TSourceVal>,
) => GeneratedItem<TContext, TTargetVal>[]

export type SingleValueTransformationFunction<
  TContext = ContextParams,
  TSourceVal = Values,
  TTargetVal extends unknown = Values,
> = (item: GeneratedItem<ContextParams & TContext, TSourceVal>) => GeneratedItem<TContext, TTargetVal> | undefined

export type AdjustFunction<TContext = ContextParams, TSourceVal = unknown, TTargetVal extends unknown = Values> = (
  item: GeneratedItem<ContextParams & TContext, TSourceVal>,
) => types.PickyRequired<Partial<GeneratedItem<TContext, TTargetVal>>, 'value'>

/**
 * transformation steps:
 * - if root is specified, look at the value under that path instead of the entire object
 * - if pick is specified, pick the specified paths
 * - if omit is specified, omit the specified paths
 * - if nestUnderField is specified, nest the entire object under the specified path
 * - if adjust is specified, run the function on the current transformation result and return the final value
 * - the transformation described above runs after converting the original value to an array (if it wasn't already).
 *   if single is true, the first result of the transformation will be returned from the resulting array
 *   (and undefined will be returned if the array is empty). if single is false, the result will be returned as-is.
 */
export type TransformDefinition<TContext = ContextParams, TTargetVal = Values> = {
  // return field name (can customize e.g. to "type => types")
  root?: string
  pick?: string[]
  omit?: string[]
  nestUnderField?: string
  // default: false for fetch, true for deploy
  single?: boolean
  adjust?: AdjustFunction<TContext, unknown, TTargetVal>
}

export type ExtractionParams<TContext = ContextParams> = {
  transformation?: TransformDefinition<TContext>

  // context to pass to request
  context?: Partial<ContextParams & TContext>
}

export type EndpointExtractionParams<TContext, ClientOptions extends string> = ExtractionParams<TContext> & {
  endpoint: HTTPEndpointIdentifier<ClientOptions> & RequestArgs
}
