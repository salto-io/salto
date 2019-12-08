import { JestEnvironment, createEnvUtils } from '@salto/e2e-credentials-store'
import { Credentials, realConnection } from '../src/client/client'

export default JestEnvironment<Credentials>({
  logBaseName: module.id,
  credsSpec: {
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
      const conn = realConnection(creds.isSandbox, { maxAttempts: 1 })
      await conn.login(creds.username, creds.password + (creds.apiToken ?? ''))
    },
    typeName: 'salesforce',
  },
})
