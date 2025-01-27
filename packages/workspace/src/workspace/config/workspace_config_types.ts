/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export type EnvConfig = {
  name: string
  services?: string[]
  accountToServiceName?: Record<string, string>
}

export type ProviderOptionsS3 = {
  bucket: string
  prefix?: string
  uploadConcurrencyLimit?: number
}

export type ProviderOptionsFile = {
  localStorageDir: string
}

type ProviderOptions = {
  s3?: ProviderOptionsS3
  file?: ProviderOptionsFile
}

type StateProviders = 'file' | 's3'

export type StateConfig = {
  provider: StateProviders
  options?: ProviderOptions
}

export type WorkspaceConfig = {
  uid: string
  staleStateThresholdMinutes?: number
  envs: EnvConfig[]
  currentEnv: string
  state?: StateConfig
}
