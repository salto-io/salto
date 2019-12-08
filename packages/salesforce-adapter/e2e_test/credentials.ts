import { Credentials } from '../src/client/client'

export default (): Credentials => {
  const credentials = global.salesforceCredentials
  if (!credentials) {
    throw new Error('global.salesforceCredentials not set. Is the Jest testEnvironment setup correctly?')
  }
  return credentials
}
