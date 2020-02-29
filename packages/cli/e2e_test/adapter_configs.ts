/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  InstanceElement, ElemID,
} from '@salto-io/adapter-api'
import {
  creator as salesforceAdapterCreator,
  testHelpers as salesforceTestHelpers,
} from '@salto-io/salesforce-adapter'

export default {
  salesforce: (): InstanceElement => {
    const { credentials } = salesforceTestHelpers()
    const configValues = {
      username: credentials.username,
      password: credentials.password,
      token: credentials.apiToken ?? '',
      sandbox: credentials.isSandbox,
    }

    const { credentialsType } = salesforceAdapterCreator

    return new InstanceElement(
      ElemID.CONFIG_NAME,
      credentialsType,
      configValues,
    )
  },
}
