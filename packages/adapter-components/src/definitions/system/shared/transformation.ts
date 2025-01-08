/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { types } from '@salto-io/lowerdash'
import { Value, Values } from '@salto-io/adapter-api'
import { HTTPEndpointIdentifier, RequestArgs } from '../requests/types'
import { ArgsWithCustomizer } from './types'

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

export type TransformFunction<TContext = ContextParams, TSourceVal = Values, TTargetVal = Values> = (
  item: GeneratedItem<ContextParams & TContext, TSourceVal>,
) => Promise<GeneratedItem<TContext, TTargetVal>[]>

export type SingleValueTransformationFunction<TContext = ContextParams, TSourceVal = Values, TTargetVal = Values> = (
  item: GeneratedItem<ContextParams & TContext, TSourceVal>,
) => Promise<GeneratedItem<TContext, TTargetVal> | undefined>

export type AdjustFunctionSingle<TContext = ContextParams, TSourceVal = unknown, TTargetVal = Values> = (
  item: GeneratedItem<ContextParams & TContext, TSourceVal>,
) => Promise<types.PickyRequired<Partial<GeneratedItem<TContext, TTargetVal>>, 'value'>>
export type AdjustFunctionMulti<TContext = ContextParams, TSourceVal = unknown, TTargetVal = Values> = (
  item: GeneratedItem<ContextParams & TContext, TSourceVal>,
) => Promise<types.PickyRequired<Partial<GeneratedItem<TContext, TTargetVal>>, 'value'>[]>
export type AdjustFunction<TContext = ContextParams, TSourceVal = unknown, TTargetVal = Values> =
  | AdjustFunctionSingle<TContext, TSourceVal, TTargetVal>
  | AdjustFunctionMulti<TContext, TSourceVal, TTargetVal>

// note: "from" and "to" can contain nested paths (e.g. a.b.c)
export type TransformationRenameDefinition = {
  from: string
  to: string
  // behavior when the target already exists:
  // - override: move "from" to "to" and lose the old "to" value
  // - skip: keep the value in "from" and do not override "to"
  // - omit: lose the value in "from" and keep the value in "to"
  onConflict: 'override' | 'skip' | 'omit'
}

/**
 * transformation steps:
 * - if rename is specified, each "from" path is moved to the corresponding "to" path. Notes:
 *     - renames are done in order, so the "from" values should be based on the most recent state
 *     - existing values will be overwritten
 * - if root is specified, look at the value under that path instead of the entire object
 * - if pick is specified, pick the specified paths
 * - if omit is specified, omit the specified paths
 * - if nestUnderField is specified, nest the entire object under the specified path
 * - if adjust is specified, run the function on the current transformation result and return the final value
 * - the transformation described above runs after converting the original value to an array (if it wasn't already).
 *   if single is true, the first result of the transformation will be returned from the resulting array
 *   (and undefined will be returned if the array is empty). if single is false, the result will be returned as-is.
 */
export type TransformDefinition<TContext = ContextParams, TTargetVal = Values | Value> = {
  rename?: TransformationRenameDefinition[]
  root?: string
  pick?: string[]
  omit?: string[]
  nestUnderField?: string
  // default: false for fetch, true for deploy
  single?: boolean
  adjust?: AdjustFunction<TContext, unknown, TTargetVal>
}

export type ExtractionParams<TContext = {}, TInput = {}> = {
  transformation?: TransformDefinition<TContext>

  // context to pass to request
  context?: ArgsWithCustomizer<Partial<ContextParams & TContext>, Partial<ContextParams & TContext>, TInput>
}

export type EndpointExtractionParams<TContext, TInput, ClientOptions extends string> = ExtractionParams<
  TContext,
  TInput
> & {
  endpoint: HTTPEndpointIdentifier<ClientOptions> & RequestArgs
}
