/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export {
  ApiDefinitions,
  APIDefinitionsOptions,
  ResolveClientOptionsType,
  ResolvePaginationOptionsType,
  ResolveCustomNameMappingOptionsType,
  ResolveReferenceContextStrategiesType,
} from './api'
export * as deploy from './deploy'
export * as fetch from './fetch'
export * as sources from './sources'
export * from './requests'
export {
  DATA_FIELD_ENTIRE_OBJECT,
  NameMappingOptions,
  NameMappingFunction,
  NameMappingFunctionMap,
  DefaultWithCustomizations,
  ArgsWithCustomizer,
  OptionsWithDefault,
  TransformDefinition,
  TransformFunction,
  AdjustFunction,
  AdjustFunctionSingle,
  AdjustFunctionMulti,
  ContextParams,
  GeneratedItem,
  ExtractionParams,
} from './shared'
export { RequiredDefinitions } from './types'
export { mergeDefinitionsWithOverrides, DEFINITIONS_OVERRIDES } from './overrides'
export * from './utils'
