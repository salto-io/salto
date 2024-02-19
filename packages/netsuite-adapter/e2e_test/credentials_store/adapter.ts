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
import NetsuiteClient from '../../src/client/client'
import { Credentials, toCredentialsAccountId } from '../../src/client/credentials'

type Args = {
  accountId: string
  tokenId: string
  tokenSecret: string
  suiteAppTokenId: string
  suiteAppTokenSecret: string
  suiteAppActivationKey: string
}

const adapter: Adapter<Args, Credentials> = {
  name: 'netsuite',
  credentialsOpts: {
    accountId: {
      type: 'string',
      demand: true,
    },
    tokenId: {
      type: 'string',
      demand: true,
    },
    tokenSecret: {
      type: 'string',
      demand: true,
    },
    suiteAppTokenId: {
      type: 'string',
      demand: true,
    },
    suiteAppTokenSecret: {
      type: 'string',
      demand: true,
    },
    suiteAppActivationKey: {
      type: 'string',
      demand: true,
    },
  },
  credentials: async args => ({
    accountId: toCredentialsAccountId(args.accountId),
    tokenId: args.tokenId,
    tokenSecret: args.tokenSecret,
    suiteAppTokenId: args.suiteAppTokenId,
    suiteAppTokenSecret: args.suiteAppTokenSecret,
    suiteAppActivationKey: args.suiteAppActivationKey,
  }),
  validateCredentials: credentials => NetsuiteClient.validateCredentials(credentials) as unknown as Promise<void>,
}

export default adapter
