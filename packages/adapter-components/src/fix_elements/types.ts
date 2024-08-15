/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
