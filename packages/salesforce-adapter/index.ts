import { CustomObject as tCustomObject } from './src/client/types'
import { CUSTOM_OBJECT } from './src/constants'
import testCredentials from './e2e_test/credentials'
import { Credentials } from './src/client/client'

export { default, creator } from './src/adapter'
export { changeValidator } from './src/change_validator'
export { default as SalesforceClient } from './src/client/client'
export { Credentials } from './src/client/client'
export { SALESFORCE as adapterId } from './src/constants'

export type TestHelpers = {
  credentials: Credentials
  CUSTOM_OBJECT: string
}

export const testHelpers = (): TestHelpers => ({
  credentials: testCredentials(),
  CUSTOM_OBJECT,
})

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace testTypes {
  export type CustomObject = tCustomObject
}
