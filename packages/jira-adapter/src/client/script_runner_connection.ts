/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { client as clientUtils } from '@salto-io/adapter-components'
import ScriptRunnerCredentials from '../script_runner_auth'

export const createScriptRunnerConnection: clientUtils.ConnectionCreator<ScriptRunnerCredentials> = retryOptions => (
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async _credentials => (
      {}
    ),
    baseURLFunc: async credentials => credentials.getBaseUrl(),
    credValidateFunc: async () => ({ accountId: '' }), // There is no login endpoint to call
  })
)
