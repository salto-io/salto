import SalesforceClient from '../src/client/client'
import credentials from './credentials'

export default (): SalesforceClient => new SalesforceClient({ credentials: credentials() })
