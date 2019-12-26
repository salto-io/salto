import { format } from 'util'
import { Credentials } from '../src/client/client'
import { credsSpec } from './jest_environment'

export default (): Credentials => {
  const { globalProp } = credsSpec
  const credentials = global[globalProp as keyof typeof global]
  if (!credentials) {
    throw new Error(
      `global[${format(globalProp)}] not set. Is the Jest testEnvironment setup correctly?`
    )
  }
  return credentials
}
