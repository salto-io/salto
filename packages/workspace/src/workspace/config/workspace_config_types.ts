/*
*                      Copyright 2021 Salto Labs Ltd.
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

export type WorkspaceConfig = {
  uid: string
  name: string
  staleStateThresholdMinutes?: number
  envs: EnvConfig[]
  currentEnv: string
}
