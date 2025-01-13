/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export {
  createDucktypeAdapterApiConfigType,
  AdapterDuckTypeApiConfig,
  DuckTypeTransformationConfig,
  DuckTypeTransformationDefaultConfig,
  TypeDuckTypeConfig,
  TypeDuckTypeDefaultsConfig,
  validateApiDefinitionConfig as validateDuckTypeApiDefinitionConfig,
  validateFetchConfig as validateDuckTypeFetchConfig,
  validateDefaultWithCustomizations,
} from './ducktype'
export {
  createRequestConfigs,
  validateRequestConfig,
  FetchRequestConfig,
  DeployRequestConfig,
  UrlParams,
  DeploymentRequestsByAction,
  RecurseIntoConfig,
} from './request'
export { ReferenceDefinitions } from '../definitions/system/references'
export {
  createAdapterApiConfigType,
  getConfigWithDefault,
  AdapterApiConfig,
  TypeConfig,
  TypeDefaultsConfig,
  validateSupportedTypes,
  defaultMissingUserFallbackField,
  AdapterFetchError,
} from './shared'
export {
  createTypeNameOverrideConfigType,
  createSwaggerAdapterApiConfigType,
  AdapterSwaggerApiConfig,
  RequestableAdapterSwaggerApiConfig,
  SwaggerDefinitionBaseConfig,
  TypeSwaggerConfig,
  RequestableTypeSwaggerConfig,
  TypeSwaggerDefaultConfig,
  TypeNameOverrideConfig,
  validateApiDefinitionConfig as validateSwaggerApiDefinitionConfig,
  validateFetchConfig as validateSwaggerFetchConfig,
} from './swagger'
export {
  createTransformationConfigTypes,
  validateTransformationConfig,
  TransformationDefaultConfig,
  TransformationConfig,
  StandaloneFieldConfigType,
  FieldToOmitType,
  FieldToHideType,
  getTransformationConfigByType,
  dereferenceFieldName,
  isReferencedIdField,
  getTypeTransformationConfig,
  shouldNestFiles,
} from './transformation'
