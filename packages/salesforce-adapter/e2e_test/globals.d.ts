import { Credentials } from '../src/types'

declare global {
  namespace globalThis {
    var salesforceCredentials: Credentials
  }
}
