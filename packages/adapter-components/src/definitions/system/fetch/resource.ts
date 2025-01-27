/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { SaltoError } from '@salto-io/adapter-api'
import { ContextCombinationDefinition, RecurseIntoDefinition } from './dependencies'
import { AdjustFunction, ArgsWithCustomizer, GeneratedItem, TransformDefinition } from '../shared'
import { ConfigChangeSuggestion } from '../../user'

export type ResourceTransformFunc = AdjustFunction<{ fragments: GeneratedItem[] }>

type FailEntireFetch = {
  // If set to true, the entire fetch will fail if an error is encountered while fetching this resource.
  // By default - false, meaning the fetch will log the error and continue, with only this resource missing.
  action: 'failEntireFetch'
  value: boolean
}

type CustomSaltoError = {
  action: 'customSaltoError'
  value: SaltoError
}

type ConfigSuggestion = {
  action: 'configSuggestion'
  value: ConfigChangeSuggestion
}

type IgnoreError = {
  action: 'ignoreError'
}

type OnErrorHandlerAction = FailEntireFetch | CustomSaltoError | ConfigSuggestion | IgnoreError | undefined

type OnErrorHandler = ArgsWithCustomizer<OnErrorHandlerAction, OnErrorHandlerAction, { error: Error; typeName: string }>

export type FetchResourceDefinition = {
  // set to true if the resource should be fetched on its own. set to false for types only fetched via recurseInto
  directFetch: boolean

  // fields used to uniquely identify this entity in the service. usually the (internal) id can be used
  serviceIDFields?: string[]

  // context arg name to type info
  // no need to specify context received from a parent's recurseInto context
  context?: ContextCombinationDefinition

  // target field name to sub-resource info
  // can be used to add nested fields containing other fetched types' responses (after the response was received),
  // and to separate child resources into their own instances
  recurseInto?: Record<string, RecurseIntoDefinition>

  // construct the final value from all fetched fragments, which are grouped by the service id
  // default behavior: merge all fragments together while concatenating array values.
  // note: on overlaps the latest fragment wins ??
  // note: concatenation order between fragments is not defined.
  mergeAndTransform?: TransformDefinition<{ fragments: GeneratedItem[] }>

  // Error handler for a specific resource.
  // The error handler is used to customize the behavior when an error occurs while fetching the resource.
  // It can be one of the following: FailEntireFetch, CustomSaltoError, ConfigSuggestion.
  // This can also be customized using a custom function that receives the error and returns the desired action.
  // If defined - the custom handling will be prioritized.
  // By default, any error thrown during the fetch is treated as if FailEntireFetch was set to false.
  onError?: OnErrorHandler
}
