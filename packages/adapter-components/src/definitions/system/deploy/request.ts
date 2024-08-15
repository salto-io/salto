/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { types } from '@salto-io/lowerdash'
import { ArgsWithCustomizer, ContextParams, EndpointExtractionParams } from '../shared'
import { ChangeAndContext } from './types'

export type ContextParamDefinitions = ArgsWithCustomizer<ContextParams, { args: ContextParams }>

export type DeployRequestEndpointDefinition<ClientOptions extends string = 'main'> = EndpointExtractionParams<
  ChangeAndContext,
  ChangeAndContext,
  ClientOptions
>

export type DeployRequestDefinition<ClientOptions extends string = 'main'> = types.XOR<
  DeployRequestEndpointDefinition<ClientOptions>,
  // when true (and matched condition), return early without making additional requests
  { earlySuccess: true }
>
