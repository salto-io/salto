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
import {
  createEnvUtils, CredsSpec, SaltoE2EJestEnvironment, JestEnvironmentConstructorArgs,
} from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import { UsernamePasswordCredentials } from '../src/auth'

const log = logger(module)

export const credsSpec = (envName?: string):
CredsSpec<Required<UsernamePasswordCredentials>> => {
  const addEnvName = (varName: string): string => (envName === undefined
    ? varName
    : [varName, envName].join('_'))
  const userNameEnvVarName = addEnvName('ZENDESK_SUPPORT_USERNAME')
  const passwordEnvVarName = addEnvName('ZENDESK_SUPPORT_PASSWORD')
  const subdomainEnvVarName = addEnvName('ZENDESK_SUPPORT_SUBDOMAIN')
  return {
    envHasCreds: env => userNameEnvVarName in env,
    fromEnv: env => {
      const envUtils = createEnvUtils(env)
      return {
        username: envUtils.required(userNameEnvVarName),
        password: envUtils.required(passwordEnvVarName),
        subdomain: envUtils.required(subdomainEnvVarName),
      }
    },
    validate: async (_creds: UsernamePasswordCredentials): Promise<void> => {
      // TODO validate when connecting with real credentials
    },
    typeName: 'zendesk_suppoort',
    globalProp: envName ? `zendesk_suppoort_${envName}` : 'zendesk_suppoort',
  }
}

export default class ZendeskSupportE2EJestEnvironment extends SaltoE2EJestEnvironment {
  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace }, ...args)
  }
}
