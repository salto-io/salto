/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'

// TODO adjust

export type AdditionalAction = never
export type ClientOptions = 'main'
type PaginationOptions = 'cursor'
// TODO set these to never if not needed
export type ReferenceContextStrategies = 'parentType'
export type CustomReferenceSerializationStrategyName = 'otherFieldName'
type CustomIndexField = CustomReferenceSerializationStrategyName

export type Options = definitions.APIDefinitionsOptions & {
  clientOptions: ClientOptions
  paginationOptions: PaginationOptions
  additionalAction: AdditionalAction
  referenceContextStrategies: ReferenceContextStrategies
  referenceSerializationStrategies: CustomReferenceSerializationStrategyName
  referenceIndexNames: CustomIndexField
}
