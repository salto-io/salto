/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { AdapterOperations } from '@salto-io/adapter-api'
import { AdapterImplConstructor, AdapterParams } from './types'
import { APIDefinitionsOptions, ResolveCustomNameMappingOptionsType, UserConfig } from '../../definitions'

export const createAdapterImpl = <
  Credentials,
  Options extends APIDefinitionsOptions,
  Co extends UserConfig<ResolveCustomNameMappingOptionsType<Options>>,
  P extends AdapterParams<Credentials, Options, Co> = AdapterParams<Credentials, Options, Co>,
>(
  args: P,
  ctor: AdapterImplConstructor<Credentials, Options, Co>,
): AdapterOperations =>
  // eslint-disable-next-line new-cap
  new ctor(args)
