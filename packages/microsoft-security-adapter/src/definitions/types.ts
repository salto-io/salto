/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, filterUtils } from '@salto-io/adapter-components'
import { UserConfig } from '../config'

export type AdditionalAction = never
export type ClientOptions = 'main'
type PaginationOptions = 'cursor'
export type ReferenceContextStrategies = 'ODataType' | 'resourceAccessType'
export type CustomReferenceSerializationStrategyName = 'appId' | 'bundleId' | 'packageId' | 'servicePrincipalAppId'
type CustomIndexField = CustomReferenceSerializationStrategyName

export type Options = definitions.APIDefinitionsOptions & {
  clientOptions: ClientOptions
  paginationOptions: PaginationOptions
  additionalAction: never
  referenceContextStrategies: ReferenceContextStrategies
  referenceSerializationStrategies: CustomReferenceSerializationStrategyName
  referenceIndexNames: CustomIndexField
}

export type EndpointPath = definitions.EndpointPath

export type FilterCreator = filterUtils.AdapterFilterCreator<UserConfig, filterUtils.FilterResult, {}, Options>
