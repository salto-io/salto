/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions } from '@salto-io/adapter-components'
import { Options } from '../../types'

export type FetchApiDefinition = definitions.fetch.InstanceFetchApiDefinitions<Options>
export type FetchCustomizations = Record<string, FetchApiDefinition>
export type ElementFieldCustomization = definitions.fetch.ElementFieldCustomization
export type FieldIDPart = definitions.fetch.FieldIDPart
export type AdjustFunctionSingle = definitions.AdjustFunctionSingle
export type AdjustFunctionMergeAndTransform = definitions.AdjustFunctionSingle<{
  fragments: definitions.GeneratedItem[]
}>
