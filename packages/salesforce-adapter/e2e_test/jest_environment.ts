import { logger } from '@salto/logging'
import { JestEnvironment, createEnvUtils, CredsSpec } from '@salto/e2e-credentials-store'
import { Credentials, validateCredentials } from '../src/client/client'

const log = logger(module)

export const credsSpec: CredsSpec<Credentials> = {
  envHasCreds: env => 'SF_USER' in env,
  fromEnv: env => {
    const envUtils = createEnvUtils(env)
    return {
      username: envUtils.required('SF_USER'),
      password: envUtils.required('SF_PASSWORD'),
      apiToken: env.SF_TOKEN ?? '',
      isSandbox: envUtils.bool('SF_SANDBOX'),
    }
  },
  validate: validateCredentials,
  typeName: 'salesforce',
  globalProp: 'salesforceCredentials',
}

export default JestEnvironment<Credentials>({
  logBaseName: log.namespace,
  credsSpec,
})
