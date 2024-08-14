/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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

export default class JiraE2EJestEnvironment extends SaltoE2EJestEnvironment {
  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace }, ...args)
  }
}
