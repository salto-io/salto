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
import { createEnvUtils, CredsSpec } from '@salto-io/e2e-credentials-store'
import { Credentials } from '../src/auth'

export const credsSpec = (isDataCenter = false): CredsSpec<Required<Credentials>> => {
  const jiraPrefix = isDataCenter ? 'JIRA_DC' : 'JIRA'
  const jiraBaseUrlVarName = `${jiraPrefix}_BASE_URL`
  const jiraUserVarName = `${jiraPrefix}_USER`
  const jiraTokenVarName = `${jiraPrefix}_TOKEN`
  return {
    envHasCreds: env => jiraBaseUrlVarName in env,
    fromEnv: env => {
      const envUtils = createEnvUtils(env)
      return {
        baseUrl: envUtils.required(jiraBaseUrlVarName),
        user: envUtils.required(jiraUserVarName),
        token: envUtils.required(jiraTokenVarName),
        isDataCenter,
      }
    },
    validate: async (_creds: Credentials): Promise<void> => {
      // TODO
    },
    typeName: isDataCenter ? 'jira_datacenter' : 'jira',
    globalProp: 'jira',
  }
}
