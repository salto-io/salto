import { Credentials, standardLoginUrl } from '../src/client/client'

const requiredEnvVar = (name: string): string => {
  if (!(name in process.env)) {
    throw new Error(`required env var ${name} missing`)
  }
  return process.env[name] ?? ''
}

const credentials = (): Credentials => ({
  username: requiredEnvVar('SF_USER'),
  password: requiredEnvVar('SF_PASSWORD'),
  apiToken: process.env.SF_TOKEN ?? '',
  loginUrl: process.env.SF_LOGIN_URL ?? standardLoginUrl(false),
})

export default credentials
