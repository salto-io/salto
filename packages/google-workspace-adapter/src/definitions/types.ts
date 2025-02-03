/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'

export type AdditionalAction = never
export type ClientOptions = 'main' | 'groupSettings' | 'cloudIdentity'
type PaginationOptions = 'cursor'
export type ReferenceContextStrategies = never
export type CustomReferenceSerializationStrategyName = 'roleId' | 'orgUnitId' | 'buildingId' | 'email'

type CustomIndexField = CustomReferenceSerializationStrategyName
export type Options = definitions.APIDefinitionsOptions & {
  clientOptions: ClientOptions
  paginationOptions: PaginationOptions
  additionalAction: AdditionalAction
  referenceContextStrategies: ReferenceContextStrategies
  referenceSerializationStrategies: CustomReferenceSerializationStrategyName
  referenceIndexNames: CustomIndexField
}
