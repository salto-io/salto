import SalesforceClient from '../src/client/client'
import createCredentials from './credentials'

export default (): SalesforceClient => new SalesforceClient({
  credentials: createCredentials(),
})
