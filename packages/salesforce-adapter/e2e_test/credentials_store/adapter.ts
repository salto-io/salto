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
import { validateCredentials } from '../../src/client/client'
import { UsernamePasswordCredentials } from '../../src/types'

type Args = {
  username: string
  password: string
  'api-token'?: string
  sandbox: boolean
}

const adapter: Adapter<Args, UsernamePasswordCredentials> = {
  name: 'salesforce',
  credentialsOpts: {
    username: {
      type: 'string',
      demand: true,
    },
    password: {
      type: 'string',
      demand: true,
    },
    'api-token': {
      type: 'string',
      demand: false,
    },
    sandbox: {
      type: 'boolean',
      default: false,
    },
  },
  credentials: async (args) =>
    new UsernamePasswordCredentials({
      username: args.username,
      password: args.password,
      apiToken: args['api-token'],
      isSandbox: args.sandbox,
    }),
  validateCredentials: (config) =>
    validateCredentials(config) as unknown as Promise<void>,
}

export default adapter
