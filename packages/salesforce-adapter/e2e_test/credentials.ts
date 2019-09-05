import { Credentials } from '../src/client/client'

const requiredEnvVar = (name: string): string => {
  const result = process.env[name]
  if (!result) {
    throw new Error(`required env var ${name} missing or empty`)
  }
  return result
}

const credentials = (): Credentials => ({
  username: requiredEnvVar('SF_USER'),
  password: requiredEnvVar('SF_PASSWORD'),
  apiToken: requiredEnvVar('SF_TOKEN'),
  isSandbox: false,
})

export default credentials
