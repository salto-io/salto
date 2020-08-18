import { Credentials } from '../src/types'

declare global {
  module NodeJS {
    interface Global {
      salesforceCredentials: Credentials
    }
  }
}
