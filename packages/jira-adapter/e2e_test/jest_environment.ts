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
import {
  createEnvUtils,
  CredsSpec,
  JestEnvironmentConstructorArgs,
  SaltoE2EJestEnvironment,
} from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import { Credentials } from '../src/auth'


const log = logger(module)

export const credsSpec = (envName?: string): CredsSpec<Required<Credentials>> => {
  const addEnvName = (varName: string): string => (envName === undefined
    ? varName
    : [varName, envName].join('_'))
  const jiraBaseUrlVarName = addEnvName('JIRA_BASE_URL')
  const jiraUserVarName = addEnvName('JIRA_USER')
  const jiraTokenVarName = addEnvName('JIRA_TOKEN')
  return {
    envHasCreds: env => jiraBaseUrlVarName in env,
    fromEnv: env => {
      const envUtils = createEnvUtils(env)
      return {
        baseUrl: envUtils.required(jiraBaseUrlVarName),
        user: envUtils.required(jiraUserVarName),
        token: envUtils.required(jiraTokenVarName),
      }
    },
    validate: async (_creds: Credentials): Promise<void> => {
      // TODO
    },
    typeName: 'jira',
    globalProp: envName ? `jira_${envName}` : 'jira',
  }
}

export default class JiraE2EJestEnvironment extends SaltoE2EJestEnvironment {
  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace }, ...args)
  }
}
