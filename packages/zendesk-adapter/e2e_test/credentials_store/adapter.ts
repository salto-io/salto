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
import { client as clientUtils } from '@salto-io/adapter-components'
import { Credentials } from '../../src/auth'
import { createConnection } from '../../src/client/connection'

type Args = {
  username: string
  password: string
  subdomain: string
}

const adapter: Adapter<Args, Credentials> = {
  name: 'zendesk',
  credentialsOpts: {
    username: {
      type: 'string',
      demand: true,
    },
    password: {
      type: 'string',
      demand: true,
    },
    subdomain: {
      type: 'string',
      demand: true,
    },
  },
  credentials: async args => ({
    username: args.username,
    password: args.password,
    subdomain: args.subdomain,
  }),
  validateCredentials: async credentials => {
    await clientUtils.validateCredentials(credentials, { createConnection })
  },
}

export default adapter
