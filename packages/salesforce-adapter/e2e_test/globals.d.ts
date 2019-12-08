import { Credentials } from '../src/client/client'

declare global {
  module NodeJS {
    interface Global {
      salesforceCredentials: Credentials
    }
  }
}
