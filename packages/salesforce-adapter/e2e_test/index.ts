/*
*                      Copyright 2022 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { logger } from '@salto-io/logging'
import { creds, CredsLease } from '@salto-io/e2e-credentials-store'
import { UsernamePasswordCredentials } from '../src/types'
import { CUSTOM_OBJECT } from '../src/constants'
import { credsSpec } from './jest_environment'
import { CustomObject as tCustomObject } from '../src/client/types'

const log = logger(module)
export type TestHelpers = {
  credentials: (envName?: string) => Promise<CredsLease<UsernamePasswordCredentials>>
  CUSTOM_OBJECT: string
}
export const testHelpers = (): TestHelpers => ({
  CUSTOM_OBJECT,
  credentials: (envName?: string) => creds(credsSpec(envName), log),
})
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace testTypes {
  export type CustomObject = tCustomObject
}
