import { logger } from '@salto/logging'
import {
  JestEnvironment, createEnvUtils, CredsSpec, SuspendCredentialsError,
} from '@salto/e2e-credentials-store'
import { Credentials, validateCredentials, ApiLimitsTooLowError } from '../src/client/client'

const MIN_API_REQUESTS_NEEDED = 500
const NOT_ENOUGH_API_REQUESTS_SUSPENSION_TIMEOUT = 1000 * 60 * 60 * 6

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
  validate: async (creds: Credentials): Promise<void> => {
    try {
      await validateCredentials(creds, MIN_API_REQUESTS_NEEDED)
    } catch (e) {
      if (e instanceof ApiLimitsTooLowError) {
        throw new SuspendCredentialsError(e, NOT_ENOUGH_API_REQUESTS_SUSPENSION_TIMEOUT)
      }
      throw e
    }
  },
  typeName: 'salesforce',
  globalProp: 'salesforceCredentials',
}

export default JestEnvironment<Credentials>({
  logBaseName: log.namespace,
  credsSpec,
})
