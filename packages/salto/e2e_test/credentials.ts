import {
  testCredentials as salesforceCredentials,
  Credentials as SalesforceCredentials,
} from 'salesforce-adapter'

const createCredentials = (): { salesforce: SalesforceCredentials } => ({
  salesforce: salesforceCredentials(),
})

export default createCredentials
