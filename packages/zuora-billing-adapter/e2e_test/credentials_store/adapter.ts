/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { Adapter } from '@salto-io/e2e-credentials-store'
import { Credentials } from '../../src/auth'

type Args = {
  baseURL: string
  clientId: string
  clientSecret: string
}

const adapter: Adapter<Args, Credentials> = {
  name: 'zuora_billing',
  credentialsOpts: {
    baseURL: {
      type: 'string',
      demand: true,
    },
    clientId: {
      type: 'string',
      demand: true,
    },
    clientSecret: {
      type: 'string',
      demand: true,
    },
  },
  credentials: async args => ({
    baseURL: args.baseURL,
    clientId: args.clientId,
    clientSecret: args.clientSecret,
  }),
  validateCredentials: async () => {
    // TODO validate when connecting with real credentials
  },
}

export default adapter
