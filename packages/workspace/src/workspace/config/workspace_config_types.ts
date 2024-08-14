/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement } from '@salto-io/adapter-api'

export type EnvConfig = {
  name: string
  services?: string[]
  accountToServiceName?: Record<string, string>
}

// The adapters config is dynamic, for this reason it returns an InstanceElement.
export type AdaptersConfig = {
  adapters: Record<string, InstanceElement>
}

export type ProviderOptionsS3 = {
  bucket: string
  prefix?: string
  uploadConcurrencyLimit?: number
}

export type ProviderOptionsFile = {
  localStorageDir: string
}

export type ProviderOptions = {
  s3?: ProviderOptionsS3
  file?: ProviderOptionsFile
}

export type StateProviders = 'file' | 's3'

export type StateConfig = {
  provider: StateProviders
  options?: ProviderOptions
}

export type WorkspaceConfig = {
  uid: string
  name: string
  staleStateThresholdMinutes?: number
  envs: EnvConfig[]
  currentEnv: string
  state?: StateConfig
}
