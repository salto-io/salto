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
import { Adapter } from '@salto-io/e2e-credentials-store'
import { Connection, MetadataInfo } from 'jsforce'
import { Credentials, validateCredentials } from '../../src/client/client'

const randomString = (length: number, chars: string): string => {
  let result = ''
  for (let i = length; i > 0; i -= 1) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
const randomAlphaNumericString = (length: number): string =>
  randomString(length, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')

interface OauthConfig {
  consumerKey: string
  consumerSecret: string
}

interface OauthConfigMetadataInfo extends MetadataInfo {
  oauthConfig: OauthConfig
}

export const createConnectedApp = async (username: string, password: string,
  email: string, callbackUrl: string): Promise<string> => {
  const conn = new Connection({})
  const fullName = `SaltoApp${Math.floor(Math.random() * 10000)}`
  let consumerKey = ''
  const consumerSecret = randomAlphaNumericString(32)
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
  await conn.metadata.read('ConnectedApp', fullName, (_err: Error | null, connectedAppData: MetadataInfo | MetadataInfo[]) => {
    consumerKey = (connectedAppData as OauthConfigMetadataInfo).oauthConfig.consumerKey
  })
  return consumerKey
}

type Args = {
  username: string
  password: string
  'api-token'?: string
  sandbox: boolean
}

const adapter: Adapter<Args, Credentials> = {
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
      'mockEmail@salto.io', 'http://localhost:8080'),
  }),
  validateCredentials: config => validateCredentials(config) as unknown as Promise<void>,
}

export default adapter
