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
import { Adapter } from '@salto-io/e2e-credentials-store'
import { RetryStrategies } from 'requestretry'
import { Connection, MetadataInfo } from 'jsforce'
import { strings } from '@salto-io/lowerdash'
import { validateCredentials, API_VERSION, createRequestModuleFunction } from '../../src/client/client'
import { UsernamePasswordCredentials } from '../../src/types'

interface OauthConfig {
  consumerKey: string
  consumerSecret: string
}

interface OauthConfigMetadataInfo extends MetadataInfo {
  oauthConfig: OauthConfig
}

export const createConnectedApp = async (username: string, password: string,
  email: string, callbackUrl: string, isSandbox: boolean): Promise<string> => {
  const conn = new Connection({
    version: API_VERSION,
    loginUrl: `https://${isSandbox ? 'test' : 'login'}.salesforce.com/`,
    requestModule: createRequestModuleFunction({
      maxAttempts: 2,
      retryStrategy: RetryStrategies.HTTPOrNetworkError,
    }),
  })
  const fullName = `SaltoApp${Math.floor(Math.random() * 10000)}`
  const consumerSecret = strings.insecureRandomString({ length: 32 })
  const requestMetadata = [{
    contactEmail: email,
    description: 'Salto oauth app',
    fullName,
    label: fullName,
    oauthConfig: {
      callbackUrl,
      consumerSecret,
      scopes: [
        'Basic',
        'Api',
        'Web',
        'Full',
        'RefreshToken',
      ],
    },
  }]
  await conn.login(username, password)
  await conn.metadata.create('ConnectedApp', requestMetadata)
  const { consumerKey } = (await conn.metadata.read('ConnectedApp', fullName) as OauthConfigMetadataInfo).oauthConfig
  return consumerKey
}

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
  credentials: async args => ({
    username: args.username,
    password: args.password,
    apiToken: args['api-token'],
    isSandbox: args.sandbox,
    consumerKey: await createConnectedApp(args.username, `${args.password}${args['api-token']}`,
      'mockEmail@salto.io', 'http://localhost:8080', args.sandbox),
  }),
  validateCredentials: config => validateCredentials(config) as unknown as Promise<void>,
}

export default adapter
