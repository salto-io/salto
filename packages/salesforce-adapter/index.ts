import { CustomObject as tCustomObject } from './src/client/types'
import { CUSTOM_OBJECT } from './src/constants'
import testCredentials from './e2e_test/credentials'

export { default, creator } from './src/adapter'
export { default as SalesforceClient } from './src/client/client'
export { Credentials } from './src/client/client'
export { SALESFORCE as adapterId } from './src/constants'

export const testHelpers = {
  credentials: testCredentials,
  CUSTOM_OBJECT,
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace testTypes {
  export type CustomObject = tCustomObject
}
